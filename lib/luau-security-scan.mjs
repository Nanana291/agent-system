#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau Security Scan — Implementation
// ──────────────────────────────────────────────

export function runLuauSecurityScan(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { fileName: path.basename(filePath), error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');

  const findings = {
    webhookLeaks: scanWebhookLeaks(source, lines),
    tokenExfiltration: scanTokenExfiltration(source, lines),
    backdoorPatterns: scanBackdoorPatterns(source, lines),
    remoteHijacking: scanRemoteHijacking(source, lines),
    suspiciousRequires: scanSuspiciousRequires(source, lines),
    antiDecompile: scanAntiDecompile(source, lines),
    obfuscation: scanObfuscation(source, lines),
    hardcodedUrls: scanHardcodedUrls(source, lines),
  };

  // Count severities
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const category of Object.values(findings)) {
    for (const finding of category) {
      switch (finding.severity) {
        case 'CRITICAL': criticalCount++; break;
        case 'HIGH': highCount++; break;
        case 'MEDIUM': mediumCount++; break;
        case 'LOW': lowCount++; break;
      }
    }
  }

  // Verdict
  let verdict;
  if (criticalCount > 0) verdict = 'MALICIOUS';
  else if (highCount > 0) verdict = 'SUSPICIOUS';
  else if (mediumCount > 0) verdict = 'WARN';
  else verdict = 'CLEAN';

  return {
    fileName: path.basename(filePath),
    filePath: absPath,
    fileSize: fs.statSync(absPath).size,
    totalLines: lines.length,
    findings,
    severityCounts: { critical: criticalCount, high: highCount, medium: mediumCount, low: lowCount },
    verdict,
  };
}

// ─── Scan Categories ───

function scanWebhookLeaks(source, lines) {
  const findings = [];

  // Discord webhook URLs
  const webhookRegex = /https?:\/\/(discord|discordapp)\.com\/api\/webhooks\/[\w-]+\/[\w-]+/gi;
  let match;
  while ((match = webhookRegex.exec(source)) !== null) {
    findings.push({
      severity: 'CRITICAL',
      type: 'Discord Webhook URL',
      line: source.slice(0, match.index).split('\n').length,
      detail: `Webhook URL exposed: ${match[0].slice(0, 50)}...`,
    });
  }

  // game:HttpPost with URL variable
  const httpPostRegex = /game\s*:\s*HttpPost\s*\(\s*([^)]+)/gi;
  while ((match = httpPostRegex.exec(source)) !== null) {
    const arg = match[1];
    if (arg.includes('http') || arg.includes('url') || arg.includes('URL')) {
      findings.push({
        severity: 'HIGH',
        type: 'HttpPost with dynamic URL',
        line: source.slice(0, match.index).split('\n').length,
        detail: `game:HttpPost called with variable URL — potential data exfiltration`,
      });
    }
  }

  // request() with webhook
  const requestRegex = /request\s*\(\s*\{[^}]*Url\s*=\s*["'](https?:\/\/[^"']*)/gi;
  while ((match = requestRegex.exec(source)) !== null) {
    if (match[1].includes('discord') || match[1].includes('webhook')) {
      findings.push({
        severity: 'CRITICAL',
        type: 'Request to webhook URL',
        line: source.slice(0, match.index).split('\n').length,
        detail: `HTTP request to webhook: ${match[1].slice(0, 50)}...`,
      });
    }
  }

  return findings;
}

function scanTokenExfiltration(source, lines) {
  const findings = [];

  // Cookie access
  const cookiePatterns = [
    { regex: /getcookies\s*\(\s*\)/i, name: 'getcookies() call' },
    { regex: /game\s*:\s*GetService\s*\(\s*["']Cookies["']\s*\)/i, name: 'Cookies service access' },
    { regex: /["']\.ROBLOSECURITY["']/i, name: '.ROBLOSECURITY reference' },
  ];

  for (const pattern of cookiePatterns) {
    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    while ((match = regex.exec(source)) !== null) {
      findings.push({
        severity: 'CRITICAL',
        type: 'Cookie/Token Access',
        line: source.slice(0, match.index).split('\n').length,
        detail: pattern.name,
      });
    }
  }

  // getgenv access (can contain sensitive data)
  const getgenvRegex = /getgenv\s*\(\s*\)/gi;
  while ((match = getgenvRegex.exec(source)) !== null) {
    const context = getContextAround(source, match.index, 100);
    // Only flag if combined with network calls
    if (context.includes('HttpPost') || context.includes('request') || context.includes('webhook')) {
      findings.push({
        severity: 'HIGH',
        type: 'getgenv + Network Call',
        line: source.slice(0, match.index).split('\n').length,
        detail: `getgenv() combined with network call — potential token exfiltration`,
      });
    }
  }

  return findings;
}

function scanBackdoorPatterns(source, lines) {
  const findings = [];

  // loadstring with HTTP
  const loadHttpRegex = /loadstring\s*\(\s*(game\s*:\s*HttpGet|httpGet|request)\s*\(/gi;
  let match;
  while ((match = loadHttpRegex.exec(source)) !== null) {
    findings.push({
      severity: 'CRITICAL',
      type: 'Remote Code Execution',
      line: source.slice(0, match.index).split('\n').length,
      detail: `loadstring() wraps HTTP response — downloads and executes remote code`,
    });
  }

  // require on module ID (potentially malicious)
  const requireIdRegex = /require\s*\(\s*(\d+)\s*\)/gi;
  while ((match = requireIdRegex.exec(source)) !== null) {
    findings.push({
      severity: 'HIGH',
      type: 'Numeric Module Require',
      line: source.slice(0, match.index).split('\n').length,
      detail: `require(${match[1]}) — loading module by ID (cannot verify content)`,
    });
  }

  // os.execute or io operations
  const ioPatterns = [
    { regex: /os\.execute\s*\(/i, name: 'os.execute() — shell command execution' },
    { regex: /io\.open\s*\(/i, name: 'io.open() — file system access' },
    { regex: /io\.write\s*\(/i, name: 'io.write() — file system write' },
  ];

  for (const pattern of ioPatterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    while ((match = regex.exec(source)) !== null) {
      findings.push({
        severity: 'HIGH',
        type: 'System/File Access',
        line: source.slice(0, match.index).split('\n').length,
        detail: pattern.name,
      });
    }
  }

  return findings;
}

function scanRemoteHijacking(source, lines) {
  const findings = [];

  // hookfunction on remotes
  const hookRemoteRegex = /hookfunction\s*\(\s*[\w.]+\.(FireServer|InvokeServer|OnServerEvent|OnServerInvoke)/gi;
  let match;
  while ((match = hookRemoteRegex.exec(source)) !== null) {
    findings.push({
      severity: 'CRITICAL',
      type: 'Remote Hijacking',
      line: source.slice(0, match.index).split('\n').length,
      detail: `hookfunction() on remote — intercepting/modifying remote calls`,
    });
  }

  // firesignal (can trigger unintended behavior)
  const firesignalRegex = /firesignal\s*\(/gi;
  while ((match = firesignalRegex.exec(source)) !== null) {
    findings.push({
      severity: 'MEDIUM',
      type: 'Signal Firing',
      line: source.slice(0, match.index).split('\n').length,
      detail: `firesignal() — can trigger arbitrary callbacks`,
    });
  }

  // fireclickdetector / fireproximityprompt (can be used for exploits)
  const fireUiRegex = /fire(clickdetector|proximityprompt)\s*\(/gi;
  while ((match = fireUiRegex.exec(source)) !== null) {
    findings.push({
      severity: 'LOW',
      type: 'UI Event Firing',
      line: source.slice(0, match.index).split('\n').length,
      detail: `${match[0]} — automated UI interaction`,
    });
  }

  return findings;
}

function scanSuspiciousRequires(source, lines) {
  const findings = [];

  // require on unknown paths
  const requireRegex = /require\s*\(\s*["']([^"']+)["']\s*\)/gi;
  let match;
  while ((match = requireRegex.exec(source)) !== null) {
    const modulePath = match[1];
    // Flag non-standard requires
    if (!modulePath.startsWith('game.') && !modulePath.startsWith('script.')) {
      findings.push({
        severity: 'MEDIUM',
        type: 'External Module Require',
        line: source.slice(0, match.index).split('\n').length,
        detail: `require("${modulePath}") — external module (verify content)`,
      });
    }
  }

  return findings;
}

function scanAntiDecompile(source, lines) {
  const findings = [];

  const antiDecompPatterns = [
    { regex: /decompile\s*\(/i, name: 'decompile() detection' },
    { regex: /isdecompiled\s*\(\s*\)/i, name: 'isdecompiled() check' },
    { regex: /if\s+.*decompile.*then/i, name: 'Conditional on decompile detection' },
  ];

  for (const pattern of antiDecompPatterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match;
    while ((match = regex.exec(source)) !== null) {
      findings.push({
        severity: 'MEDIUM',
        type: 'Anti-Decompile',
        line: source.slice(0, match.index).split('\n').length,
        detail: pattern.name,
      });
    }
  }

  return findings;
}

function scanObfuscation(source, lines) {
  const findings = [];

  // String.char chains
  const stringCharCount = (source.match(/string\.char\s*\(/g) || []).length;
  if (stringCharCount > 10) {
    findings.push({
      severity: 'LOW',
      type: 'String Obfuscation',
      line: 1,
      detail: `${stringCharCount} string.char() calls — possible encoded strings`,
    });
  }

  // Excessive hex strings
  const hexCount = (source.match(/\\x[0-9a-fA-F]{2}/g) || []).length;
  if (hexCount > 20) {
    findings.push({
      severity: 'MEDIUM',
      type: 'Hex Encoding',
      line: 1,
      detail: `${hexCount} hex-encoded characters — obfuscated strings`,
    });
  }

  // Very long single line (packed code)
  const maxLineLength = Math.max(...lines.map(l => l.length), 0);
  if (maxLineLength > 5000) {
    findings.push({
      severity: 'MEDIUM',
      type: 'Packed Code',
      line: lines.findIndex(l => l.length > 5000) + 1,
      detail: `Line with ${maxLineLength} characters — likely packed/obfuscated`,
    });
  }

  // Meaningless variable names
  const shortVarCount = (source.match(/\b_[0-9]+\b/g) || []).length;
  if (shortVarCount > 20) {
    findings.push({
      severity: 'LOW',
      type: 'Variable Obfuscation',
      line: 1,
      detail: `${shortVarCount} variables named _N — likely obfuscated`,
    });
  }

  return findings;
}

function scanHardcodedUrls(source, lines) {
  const findings = [];

  // URLs in source (not webhook-related)
  const urlRegex = /https?:\/\/[^\s"')]+/gi;
  let match;
  const urls = new Set();
  while ((match = urlRegex.exec(source)) !== null) {
    const url = match[0];
    if (!url.includes('discord') && !url.includes('github') && !url.includes('jsdelivr')) {
      urls.add(url);
    }
  }

  for (const url of urls) {
    findings.push({
      severity: 'LOW',
      type: 'Hardcoded URL',
      line: source.indexOf(url) > 0 ? source.slice(0, source.indexOf(url)).split('\n').length : 1,
      detail: `External URL: ${url.slice(0, 60)}...`,
    });
  }

  return findings;
}

// ─── Helpers ───

function getContextAround(source, index, range) {
  const start = Math.max(0, index - range);
  const end = Math.min(source.length, index + range);
  return source.slice(start, end);
}

// ─── Renderer ───

export function renderLuauSecurityScan(result) {
  if (result.error) {
    return `[LUAU SECURITY SCAN] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push(`[LUAU SECURITY SCAN] ${result.fileName}`);
  lines.push('─'.repeat(50));
  lines.push(`File size:       ${result.fileSize} bytes`);
  lines.push(`Lines:           ${result.totalLines}`);
  lines.push('');

  const severityIcon = {
    CRITICAL: '🔴',
    HIGH: '🟠',
    MEDIUM: '🟡',
    LOW: '🟢',
  };

  const categoryLabels = {
    webhookLeaks: 'Webhook Leaks',
    tokenExfiltration: 'Token Exfiltration',
    backdoorPatterns: 'Backdoor Patterns',
    remoteHijacking: 'Remote Hijacking',
    suspiciousRequires: 'Suspicious Requires',
    antiDecompile: 'Anti-Decompile',
    obfuscation: 'Obfuscation',
    hardcodedUrls: 'Hardcoded URLs',
  };

  for (const [category, findings] of Object.entries(result.findings)) {
    if (findings.length === 0) continue;

    lines.push(`### ${categoryLabels[category] || category}`);
    lines.push('');
    lines.push('| Severity | Type | Line | Detail |');
    lines.push('|----------|------|------|--------|');

    for (const finding of findings) {
      lines.push(`| ${severityIcon[finding.severity] || '?'} ${finding.severity} | ${finding.type} | ${finding.line} | ${finding.detail} |`);
    }
    lines.push('');
  }

  lines.push('─'.repeat(50));
  lines.push(`Critical: ${result.severityCounts.critical} | High: ${result.severityCounts.high} | Medium: ${result.severityCounts.medium} | Low: ${result.severityCounts.low}`);
  lines.push('');
  lines.push(`Verdict: ${result.verdict}`);
  lines.push('─'.repeat(50));

  return lines.join('\n');
}
