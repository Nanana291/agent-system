#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau Report — Unified Quality Report
// ──────────────────────────────────────────────
// Combines all quality checks into a single
// human-readable markdown report with executive
// summary, score breakdown, grouped findings,
// prioritized recommendations, compatibility
// matrix, and trend chart (if snapshots exist).

export function runLuauReport(filePath, options = {}) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');

  // Gather all data
  const overview = extractOverview(absPath, source, lines);
  const features = extractFeatures(source);
  const remotes = extractRemotes(source);
  const functions = extractFunctions(source, lines);
  const loops = extractLoops(source, lines);
  const lifecycle = extractLifecycle(source);
  const config = extractConfig(source);

  // Quality checks
  const securityCheck = checkSecurity(source);
  const perfCheck = checkPerf(source, lines);
  const pcallCheck = checkPcall(source);
  const deadCodeCheck = checkDeadCode(source, lines);
  const flowCheck = checkFlow(source, lines);
  const compatCheck = checkCompat(source);
  const complexityCheck = checkComplexity(source, lines);

  // Aggregate scores
  const scores = {
    security: securityCheck.score,
    performance: perfCheck.score,
    remoteSafety: pcallCheck.protectionRate,
    codeQuality: complexityCheck.score,
    deadCode: 100 - deadCodeCheck.deadPercent * 3,
    dataFlow: flowCheck.score,
    compatibility: compatCheck.minScore,
  };

  const overallScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length);

  // Findings grouped by severity
  const findings = [
    ...securityCheck.findings,
    ...perfCheck.findings,
    ...pcallCheck.findings,
    ...deadCodeCheck.findings,
    ...flowCheck.findings,
    ...compatCheck.findings,
    ...complexityCheck.findings,
  ].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (order[a.severity] || 4) - (order[b.severity] || 4);
  });

  // Recommendations
  const recommendations = generateRecommendations(findings, scores);

  // Trend data (if previous snapshots exist)
  const trend = options.snapshotDir ? loadTrendData(filePath, options.snapshotDir) : null;

  let verdict;
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = findings.filter(f => f.severity === 'HIGH').length;
  if (criticalCount > 0) verdict = 'FAIL';
  else if (highCount > 3) verdict = 'DEGRADED';
  else if (highCount > 0) verdict = 'WARN';
  else verdict = 'PASS';

  return {
    fileName: path.basename(absPath),
    filePath: absPath,
    timestamp: new Date().toISOString(),
    overview,
    scores,
    overallScore,
    verdict,
    features,
    remotes,
    functions,
    loops,
    lifecycle,
    config,
    findings,
    recommendations,
    trend,
    summary: {
      totalFindings: findings.length,
      criticalCount,
      highCount,
      mediumCount: findings.filter(f => f.severity === 'MEDIUM').length,
      lowCount: findings.filter(f => f.severity === 'LOW').length,
    },
  };
}

// ─── Extractors ───

function extractOverview(absPath, source, lines) {
  return {
    lines: lines.length,
    size: fs.statSync(absPath).size,
    framework: detectFramework(source),
    features: (source.match(/BuildToggle|CreateToggle|BuildDropdown|BuildSlider|BuildButton/g) || []).length,
    remotes: (source.match(/FireServer|InvokeServer/g) || []).length,
  };
}

function detectFramework(source) {
  if (/LibSixtyTen/.test(source)) return 'LibSixtyTen';
  if (/Obsidian/.test(source)) return 'Obsidian';
  if (/Orion/.test(source)) return 'Orion';
  return 'Unknown';
}

function extractFeatures(source) {
  const features = [];
  for (const pattern of [
    /BuildToggle\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi,
    /BuildDropdown\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi,
    /BuildSlider\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi,
    /BuildButton\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi,
  ]) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      features.push({ type: 'Feature', name: match[1] });
    }
  }
  return features;
}

function extractRemotes(source) {
  const remotes = [];
  for (const match of source.matchAll(/([\w.]+)\s*:\s*(FireServer|InvokeServer)\s*\(/g)) {
    remotes.push({ remote: match[1], method: match[2] });
  }
  return remotes;
}

function extractFunctions(source, lines) {
  const functions = [];
  for (const match of source.matchAll(/local\s+function\s+(\w+)\s*\(([^)]*)\)/g)) {
    const line = source.slice(0, match.index).split('\n').length;
    const params = match[2] ? match[2].split(',').length : 0;
    functions.push({ name: match[1], params, line });
  }
  return functions;
}

function extractLoops(source, lines) {
  const loops = [];
  for (const match of source.matchAll(/taskSpawn\s*\(\s*function/g)) {
    const line = source.slice(0, match.index).split('\n').length;
    const context = source.slice(match.index, Math.min(source.length, match.index + 500));
    loops.push({
      line,
      hasWait: /task\.wait/.test(context),
      hasPcall: /pcall|pcallRef/.test(context),
      hasWhile: /while\s+/.test(context),
    });
  }
  return loops;
}

function extractLifecycle(source) {
  return {
    characterAdded: /CharacterAdded/.test(source),
    humanoidRootPart: /HumanoidRootPart/.test(source),
    findFirstChild: /FindFirstChild.*HumanoidRootPart/.test(source),
  };
}

function extractConfig(source) {
  return {
    saveManager: source.includes('SaveManager'),
    themeManager: source.includes('ThemeManager'),
    autoload: /LoadAutoloadConfig|load_autoload/.test(source),
  };
}

// ─── Check Implementations ───

function checkSecurity(source) {
  const findings = [];
  let score = 100;

  if (/discord.*webhook/i.test(source)) { findings.push({ severity: 'CRITICAL', category: 'security', detail: 'Discord webhook URL detected' }); score -= 30; }
  if (/getcookies|\.ROBLOSECURITY/.test(source)) { findings.push({ severity: 'CRITICAL', category: 'security', detail: 'Cookie/token access detected' }); score -= 30; }
  if (/loadstring.*HttpGet/.test(source)) { findings.push({ severity: 'HIGH', category: 'security', detail: 'Remote code execution via loadstring' }); score -= 15; }
  if (/hookfunction/.test(source)) { findings.push({ severity: 'MEDIUM', category: 'security', detail: 'Function hooking detected' }); score -= 10; }
  if (/os\.execute|io\.open/.test(source)) { findings.push({ severity: 'MEDIUM', category: 'security', detail: 'System/file access detected' }); score -= 10; }

  return { findings, score: Math.max(0, score) };
}

function checkPerf(source, lines) {
  const findings = [];
  let score = 100;

  // FindFirstChild in loops
  const loopRanges = findLoopRanges(source, lines);
  for (const loop of loopRanges) {
    for (let i = loop.startLine; i <= loop.endLine && i < lines.length; i++) {
      if (/:FindFirstChild\s*\(/.test(lines[i - 1] || '')) {
        findings.push({ severity: 'CRITICAL', category: 'performance', detail: `FindFirstChild inside loop at L${i}` });
        score -= 10;
      }
    }
  }

  // Repeated GetService
  const serviceCount = {};
  for (const match of source.matchAll(/game\s*:\s*GetService\s*\(\s*["'](\w+)["']/g)) {
    serviceCount[match[1]] = (serviceCount[match[1]] || 0) + 1;
  }
  for (const [service, count] of Object.entries(serviceCount)) {
    if (count > 2) { findings.push({ severity: 'HIGH', category: 'performance', detail: `GetService("${service}") called ${count} times` }); score -= 8; }
  }

  return { findings, score: Math.max(0, score) };
}

function checkPcall(source) {
  const findings = [];
  const remoteCalls = [];

  for (const match of source.matchAll(/([\w.]+)\s*:\s*(FireServer|InvokeServer)\s*\(/g)) {
    const line = source.slice(0, match.index).split('\n').length;
    const context = source.slice(Math.max(0, match.index - 100), match.index + match[0].length + 100);
    const pcallWrapped = /pcall|pcallRef/.test(context);
    remoteCalls.push({ line, method: match[2], pcallWrapped });
    if (!pcallWrapped) {
      findings.push({ severity: 'HIGH', category: 'remote-safety', detail: `${match[2]} not pcall-wrapped at L${line}` });
    }
  }

  const protected_ = remoteCalls.filter(c => c.pcallWrapped).length;
  const total = remoteCalls.length;

  return { findings, protectionRate: total > 0 ? Math.round((protected_ / total) * 100) : 100 };
}

function checkDeadCode(source, lines) {
  const findings = [];
  let deadCount = 0;
  let totalFuncs = 0;

  for (const match of source.matchAll(/local\s+function\s+(\w+)\s*\(/g)) {
    totalFuncs++;
    const name = match[1];
    if (name.startsWith('_')) continue;
    const callCount = (source.match(new RegExp(`\\b${name}\\s*\\(`, 'g')) || []).length - 1;
    if (callCount <= 0) {
      deadCount++;
      findings.push({ severity: 'LOW', category: 'dead-code', detail: `Function "${name}" never called (L${source.slice(0, match.index).split('\n').length})` });
    }
  }

  return { findings, deadCount, totalFunctions: totalFuncs, deadPercent: totalFuncs > 0 ? Math.round((deadCount / totalFuncs) * 100) : 0 };
}

function checkFlow(source, lines) {
  const findings = [];
  let score = 100;

  // TaskSpawn without while
  for (const match of source.matchAll(/taskSpawn\s*\(\s*function\s*\(\s*\)/g)) {
    const context = source.slice(match.index, Math.min(source.length, match.index + 600));
    if (!/while\s+/.test(context)) {
      findings.push({ severity: 'HIGH', category: 'data-flow', detail: `taskSpawn without while loop at L${source.slice(0, match.index).split('\n').length}` });
      score -= 10;
    }
    if (/while\s+/.test(context) && !/task\.wait/.test(context)) {
      findings.push({ severity: 'CRITICAL', category: 'data-flow', detail: `Loop without task.wait at L${source.slice(0, match.index).split('\n').length}` });
      score -= 15;
    }
  }

  // No character rebind
  if (/HumanoidRootPart/.test(source) && !/CharacterAdded/.test(source)) {
    findings.push({ severity: 'HIGH', category: 'data-flow', detail: 'No CharacterAdded rebind for HumanoidRootPart' });
    score -= 10;
  }

  return { findings, score: Math.max(0, score) };
}

function checkCompat(source) {
  const apis = [
    { name: 'getgenv', supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'] },
    { name: 'writefile', supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'] },
    { name: 'request', supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'] },
    { name: 'hookfunction', supportedBy: ['ScriptWare', 'Fluxus', 'Delta'] },
    { name: 'Drawing', supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'] },
  ];

  const executors = ['ScriptWare', 'Fluxus', 'Delta', 'Codex', 'Hydrogen'];
  const scores = {};
  const findings = [];

  for (const exec of executors) {
    let supported = 0;
    let total = 0;
    for (const api of apis) {
      if (new RegExp(api.name, 'i').test(source)) {
        total++;
        if (api.supportedBy.includes(exec)) supported++;
        else findings.push({ severity: 'MEDIUM', category: 'compatibility', detail: `${api.name} not supported on ${exec}` });
      }
    }
    scores[exec] = total > 0 ? Math.round((supported / total) * 100) : 100;
  }

  return { findings, scores, minScore: Math.min(...Object.values(scores)), verdict: Math.min(...Object.values(scores)) >= 80 ? 'PASS' : 'WARN' };
}

function checkComplexity(source, lines) {
  let maxComplexity = 0;
  let totalComplexity = 0;
  let funcCount = 0;

  for (const match of source.matchAll(/local\s+function\s+\w+\s*\(([^)]*)\)/g)) {
    const line = source.slice(0, match.index).split('\n').length;
    const endLine = findFuncEnd(lines, line - 1);
    const body = lines.slice(line - 1, endLine).join('\n');
    let complexity = 1;
    for (const p of [/\bif\b/g, /\belseif\b/g, /\band\b/g, /\bor\b/g, /\bfor\b/g, /\bwhile\b/g]) {
      complexity += (body.match(p) || []).length;
    }
    maxComplexity = Math.max(maxComplexity, complexity);
    totalComplexity += complexity;
    funcCount++;
  }

  const score = maxComplexity <= 10 ? 100 : maxComplexity <= 20 ? 70 : maxComplexity <= 30 ? 40 : 20;

  return { score, maxComplexity, avgComplexity: funcCount > 0 ? Math.round(totalComplexity / funcCount) : 0 };
}

// ─── Helpers ───

function findLoopRanges(source, lines) {
  const loops = [];
  for (const match of source.matchAll(/taskSpawn\s*\(\s*function/g)) {
    const startLine = source.slice(0, match.index).split('\n').length;
    loops.push({ startLine, endLine: Math.min(lines.length, startLine + 200) });
  }
  return loops;
}

function findFuncEnd(lines, startIdx) {
  let depth = 0;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*--/.test(line)) continue;
    depth += (line.match(/\b(if|then|else|elseif|for|while|do|function|repeat)\b/g) || []).length;
    depth -= (line.match(/^\s*end\b/g) || []).length;
    if (depth <= 0 && i > startIdx) return i;
  }
  return lines.length - 1;
}

function generateRecommendations(findings, scores) {
  const recs = [];

  if (scores.security < 80) recs.push({ priority: 'CRITICAL', action: 'Remove webhook URLs and token access patterns' });
  if (scores.remoteSafety < 80) recs.push({ priority: 'HIGH', action: 'Wrap all FireServer/InvokeServer calls in pcallRef' });
  if (scores.performance < 80) recs.push({ priority: 'HIGH', action: 'Cache FindFirstChild results and GetService calls outside loops' });
  if (scores.dataFlow < 80) recs.push({ priority: 'HIGH', action: 'Add task.wait() to all loops and CharacterAdded rebind' });
  if (scores.compatibility < 80) recs.push({ priority: 'MEDIUM', action: 'Add fallback chains for non-universal APIs' });
  if (scores.deadCode < 70) recs.push({ priority: 'LOW', action: 'Remove or prefix unused functions with underscore' });
  if (scores.codeQuality < 60) recs.push({ priority: 'MEDIUM', action: 'Refactor high-complexity functions into smaller units' });

  return recs.sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (order[a.priority] || 4) - (order[b.priority] || 4);
  });
}

function loadTrendData(filePath, snapshotDir) {
  const snapshots = [];
  if (!fs.existsSync(snapshotDir)) return null;

  for (const file of fs.readdirSync(snapshotDir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(snapshotDir, file), 'utf8'));
      if (data.fileName === path.basename(filePath) || data.filePath === filePath) {
        snapshots.push({ timestamp: data.timestamp, score: data.scores?.overallScore || data.overallScore || 0, verdict: data.verdict });
      }
    } catch { /* skip */ }
  }

  return snapshots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// ─── Renderer ───

export function renderReportMarkdown(report) {
  const lines = [];
  const sevIcon = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' };

  lines.push(`# Quality Report — ${report.fileName}`);
  lines.push('');
  lines.push(`> Generated: ${report.timestamp}`);
  lines.push(`> Overall Score: **${report.overallScore}/100** | Verdict: **${report.verdict}**`);
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Lines | ${report.overview.lines} |`);
  lines.push(`| Size | ${(report.overview.size / 1024).toFixed(1)} KB |`);
  lines.push(`| Framework | ${report.overview.framework} |`);
  lines.push(`| Features | ${report.overview.features} |`);
  lines.push(`| Remote Calls | ${report.overview.remotes} |`);
  lines.push(`| Functions | ${report.functions.length} |`);
  lines.push(`| Loops | ${report.loops.length} |`);
  lines.push(`| Overall Score | ${report.overallScore}/100 |`);
  lines.push(`| Verdict | ${report.verdict} |`);
  lines.push('');

  // Score Breakdown
  lines.push('## Score Breakdown');
  lines.push('');
  lines.push('| Category | Score | Status |');
  lines.push('|----------|-------|--------|');
  const scoreLabels = { security: 'Security', performance: 'Performance', remoteSafety: 'Remote Safety', codeQuality: 'Code Quality', deadCode: 'Dead Code', dataFlow: 'Data Flow', compatibility: 'Compatibility' };
  for (const [key, value] of Object.entries(report.scores)) {
    const status = value >= 80 ? '✅ Pass' : value >= 60 ? '⚠️  Warn' : '❌ Fail';
    lines.push(`| ${scoreLabels[key] || key} | ${value}/100 | ${status} |`);
  }
  lines.push('');

  // Trend chart (if available)
  if (report.trend && report.trend.length > 1) {
    lines.push('## Score Trend');
    lines.push('');
    lines.push('| Date | Score | Verdict |');
    lines.push('|------|-------|---------|');
    for (const snap of report.trend) {
      lines.push(`| ${new Date(snap.timestamp).toLocaleDateString()} | ${snap.score} | ${snap.verdict} |`);
    }
    lines.push('');
  }

  // Findings
  if (report.findings.length > 0) {
    lines.push(`## Findings (${report.findings.length})`);
    lines.push('');
    for (const f of report.findings) {
      lines.push(`- ${sevIcon[f.severity] || '?'} **[${f.severity}]** ${f.detail} (${f.category})`);
    }
    lines.push('');
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');
    for (const r of report.recommendations) {
      lines.push(`- ${sevIcon[r.priority] || '?'} **[${r.priority}]** ${r.action}`);
    }
    lines.push('');
  }

  // Loops
  if (report.loops.length > 0) {
    lines.push('## Loop Safety');
    lines.push('');
    lines.push('| # | Line | Wait | Pcall | While |');
    lines.push('|---|------|------|-------|-------|');
    for (let i = 0; i < report.loops.length; i++) {
      const l = report.loops[i];
      lines.push(`| ${i + 1} | ${l.line} | ${l.hasWait ? '✅' : '❌'} | ${l.hasPcall ? '✅' : '❌'} | ${l.hasWhile ? '✅' : '❌'} |`);
    }
    lines.push('');
  }

  // Lifecycle
  lines.push('## Lifecycle');
  lines.push('');
  const lc = report.lifecycle;
  lines.push(`| Pattern | Status |`);
  lines.push(`|---------|--------|`);
  lines.push(`| CharacterAdded | ${lc.characterAdded ? '✅' : '❌'} |`);
  lines.push(`| FindFirstChild HRP | ${lc.findFirstChild ? '✅' : '❌'} |`);
  lines.push('');

  // Config
  if (report.config.saveManager || report.config.themeManager) {
    lines.push('## Configuration');
    lines.push('');
    lines.push(`| System | Status |`);
    lines.push(`|--------|--------|`);
    lines.push(`| SaveManager | ${report.config.saveManager ? '✅' : '❌'} |`);
    lines.push(`| ThemeManager | ${report.config.themeManager ? '✅' : '❌'} |`);
    lines.push(`| Autoload | ${report.config.autoload ? '✅' : '❌'} |`);
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Report generated by agent-system luau-report*`);

  return lines.join('\n');
}
