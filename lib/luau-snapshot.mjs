#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ──────────────────────────────────────────────
// Luau Snapshot — Combined Quality Snapshot
// ──────────────────────────────────────────────
// Runs all quality checks in a single step and
// produces a portable JSON snapshot with
// timestamp, checksum, and per-category verdict.

export function runLuauSnapshot(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');
  const fileName = path.basename(absPath);

  // Checksums
  const md5 = crypto.createHash('md5').update(source).digest('hex');
  const sha256 = crypto.createHash('sha256').update(source).digest('hex');

  const timestamp = new Date().toISOString();

  // Run all quality checks
  const checks = {};

  // 1. Regression Gate
  checks.regressionGate = runRegressionGate(source, lines);

  // 2. Security Scan
  checks.securityScan = runSecurityScan(source, lines);

  // 3. Complexity Analysis
  checks.complexity = runComplexityAnalysis(source, lines);

  // 4. Perf Profile
  checks.perfProfile = runPerfProfile(source, lines);

  // 5. Pcall Audit
  checks.pcallAudit = runPcallAudit(source, lines);

  // 6. Dead Code
  checks.deadCode = runDeadCode(source, lines);

  // 7. Verify Flow
  checks.verifyFlow = runVerifyFlow(source, lines);

  // 8. Compatibility Check
  checks.compatCheck = runCompatCheck(source, lines);

  // Compute aggregate scores
  const scores = computeScores(checks);

  // Overall verdict
  const blocked = Object.values(checks).filter(c => c.verdict === 'BLOCKED' || c.verdict === 'FAIL' || c.verdict === 'MALICIOUS' || c.verdict === 'INCOMPATIBLE' || c.verdict === 'POOR' || c.verdict === 'CRITICAL');
  const warned = Object.values(checks).filter(c => c.verdict === 'WARN' || c.verdict === 'CONDITIONAL' || c.verdict === 'SUSPICIOUS' || c.verdict === 'LIMITED' || c.verdict === 'BELOW_AVG' || c.verdict === 'RISKY');

  let verdict;
  if (blocked.length > 0) verdict = 'FAIL';
  else if (warned.length > 3) verdict = 'DEGRADED';
  else if (warned.length > 0) verdict = 'PASS_WITH_WARNINGS';
  else verdict = 'PASS';

  return {
    fileName,
    filePath: absPath,
    timestamp,
    checksum: { md5, sha256 },
    fileSize: fs.statSync(absPath).size,
    totalLines: lines.length,
    checks,
    scores,
    verdict,
    summary: {
      totalChecks: Object.keys(checks).length,
      blocked: blocked.length,
      warned: warned.length,
      passed: Object.keys(checks).length - blocked.length - warned.length,
    },
  };
}

// ─── Check Implementations ───

function runRegressionGate(source, lines) {
  // Risk score
  let riskScore = 0;
  const remoteCalls = extractAllRemoteCalls(source);
  for (const call of remoteCalls) {
    if (!call.pcallWrapped) riskScore += 5;
  }
  const whileCount = (source.match(/^\s*while\s+/gm) || []).length;
  riskScore += whileCount * 3;
  riskScore = Math.min(100, riskScore);

  // Remote safety
  const unprotected = remoteCalls.filter(c => !c.pcallWrapped);

  // Loop safety
  let safeLoops = 0;
  let totalLoops = 0;
  for (const line of lines) {
    if (/^\s*while\s+/.test(line)) {
      totalLoops++;
      if (/task\.wait/.test(line)) safeLoops++;
    }
  }

  // Character lifecycle
  const hasCharacterAdded = /CharacterAdded/.test(source);
  const hasFindFirstChild = /FindFirstChild.*HumanoidRootPart/.test(source);

  let verdict = 'PASS';
  if (unprotected.filter(c => c.method === 'FireServer' || c.method === 'InvokeServer').length > 3) verdict = 'BLOCKED';
  else if (unprotected.length > 0) verdict = 'WARN';

  return {
    riskScore,
    remoteSafety: { protected: remoteCalls.length - unprotected.length, total: remoteCalls.length, unprotected: unprotected.map(c => c.line) },
    loopSafety: { safe: safeLoops, total: totalLoops },
    characterLifecycle: hasCharacterAdded && hasFindFirstChild ? 'PASS' : 'WARN',
    verdict,
  };
}

function runSecurityScan(source, lines) {
  const findings = [];

  // Webhook leaks
  if (/discord.*webhook/i.test(source)) findings.push('Discord webhook detected');

  // Token exfiltration
  if (/getcookies|\.ROBLOSECURITY/.test(source)) findings.push('Cookie/token access detected');

  // Remote code execution
  if (/loadstring.*HttpGet/.test(source)) findings.push('Remote code execution via loadstring');

  // Hookfunction
  if (/hookfunction/.test(source)) findings.push('Function hooking detected');

  // System access
  if (/os\.execute|io\.open|io\.write/.test(source)) findings.push('System/file access detected');

  let verdict = 'CLEAN';
  if (findings.length > 0) verdict = findings.some(f => f.includes('cookie') || f.includes('webhook')) ? 'SUSPICIOUS' : 'WARN';

  return { findings, verdict };
}

function runComplexityAnalysis(source, lines) {
  const functions = [];
  const regex = /(?:local\s+function\s+(\w+)|local\s+(\w+)\s*=\s*function)\s*\(([^)]*)\)/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const name = match[1] || match[2];
    const line = source.slice(0, match.index).split('\n').length;
    const endLine = findFuncEnd(lines, line - 1);
    const body = lines.slice(line - 1, endLine).join('\n');
    let complexity = 1;
    for (const p of [/\bif\b/g, /\belseif\b/g, /\band\b/g, /\bor\b/g, /\bfor\b/g, /\bwhile\b/g]) {
      complexity += (body.match(p) || []).length;
    }
    functions.push({ name, line, complexity, lineCount: endLine - line + 1 });
  }

  const maxComplexity = functions.length > 0 ? Math.max(...functions.map(f => f.complexity)) : 0;
  const avgComplexity = functions.length > 0 ? Math.round(functions.reduce((s, f) => s + f.complexity, 0) / functions.length) : 0;
  const mostComplex = functions.find(f => f.complexity === maxComplexity)?.name || 'none';

  let verdict = 'PASS';
  if (maxComplexity > 20) verdict = 'WARN';
  else if (maxComplexity > 30) verdict = 'BLOCKED';

  return { functionCount: functions.length, maxComplexity, avgComplexity, mostComplex, verdict };
}

function runPerfProfile(source, lines) {
  const issues = [];

  // FindFirstChild in loops
  const loopRanges = findLoopRanges(source, lines);
  for (const loop of loopRanges) {
    for (let i = loop.startLine; i <= loop.endLine && i < lines.length; i++) {
      if (/:FindFirstChild\s*\(/.test(lines[i - 1] || '')) {
        issues.push({ type: 'FindFirstChild in loop', line: i, severity: 'CRITICAL' });
      }
    }
  }

  // Repeated GetService
  const serviceCount = {};
  for (const match of source.matchAll(/game\s*:\s*GetService\s*\(\s*["'](\w+)["']/g)) {
    serviceCount[match[1]] = (serviceCount[match[1]] || 0) + 1;
  }
  for (const [service, count] of Object.entries(serviceCount)) {
    if (count > 1) issues.push({ type: `GetService("${service}") called ${count} times`, line: 1, severity: 'HIGH' });
  }

  // Repeated requires
  const requireCount = {};
  for (const match of source.matchAll(/require\s*\(\s*([^)]+)\s*\)/g)) {
    requireCount[match[1]] = (requireCount[match[1]] || 0) + 1;
  }
  for (const [mod, count] of Object.entries(requireCount)) {
    if (count > 1) issues.push({ type: `require(${mod}) called ${count} times`, line: 1, severity: 'HIGH' });
  }

  const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
  const highCount = issues.filter(i => i.severity === 'HIGH').length;
  const score = Math.max(0, 100 - criticalCount * 15 - highCount * 8);

  let verdict = 'EXCELLENT';
  if (criticalCount > 0) verdict = 'POOR';
  else if (highCount > 3) verdict = 'BELOW_AVG';
  else if (highCount > 0) verdict = 'AVG';

  return { issues: issues.slice(0, 20), issueCount: issues.length, score, verdict };
}

function runPcallAudit(source, lines) {
  const remoteCalls = extractAllRemoteCalls(source);
  const protected_ = remoteCalls.filter(c => c.pcallWrapped);
  const unprotected = remoteCalls.filter(c => !c.pcallWrapped);

  const serverUnprotected = unprotected.filter(c => c.method === 'FireServer' || c.method === 'InvokeServer');

  let verdict = 'SAFE';
  if (serverUnprotected.length > 5) verdict = 'CRITICAL';
  else if (serverUnprotected.length > 0) verdict = 'HIGH';
  else if (unprotected.length > 0) verdict = 'MEDIUM';

  return {
    total: remoteCalls.length,
    protected: protected_.length,
    unprotected: unprotected.length,
    protectionRate: remoteCalls.length > 0 ? Math.round((protected_.length / remoteCalls.length) * 100) : 100,
    serverUnprotected: serverUnprotected.map(c => ({ line: c.line, method: c.method, remote: c.remote })),
    verdict,
  };
}

function runDeadCode(source, lines) {
  const functions = [];
  const funcRegex = /local\s+function\s+(\w+)\s*\(/g;
  let match;
  while ((match = funcRegex.exec(source)) !== null) {
    const name = match[1];
    const line = source.slice(0, match.index).split('\n').length;
    const callCount = (source.match(new RegExp(`\\b${name}\\s*\\(`, 'g')) || []).length - 1;
    if (callCount <= 0 && !name.startsWith('_')) {
      functions.push({ name, line });
    }
  }

  const totalFuncs = (source.match(/local\s+function\s+\w+\s*\(/g) || []).length;
  const deadPercent = totalFuncs > 0 ? Math.round((functions.length / totalFuncs) * 100) : 0;

  let verdict = 'CLEAN';
  if (deadPercent > 15) verdict = 'HIGH';
  else if (deadPercent > 8) verdict = 'MEDIUM';
  else if (functions.length > 0) verdict = 'LOW';

  return { deadFunctions: functions.length, totalFunctions: totalFuncs, deadPercent, functions: functions.slice(0, 10), verdict };
}

function runVerifyFlow(source, lines) {
  const issues = [];

  // Use before def
  const definitions = new Map();
  for (const match of source.matchAll(/^\s*local\s+(\w+)\s*(?:=\s*(.+))?$/gm)) {
    definitions.set(match[1], source.slice(0, match.index).split('\n').length);
  }

  for (const [name, defLine] of definitions) {
    if (name.startsWith('_')) continue;
    const useRegex = new RegExp(`\\b${name}\\b`, 'g');
    let useMatch;
    while ((useMatch = useRegex.exec(source)) !== null) {
      const useLine = source.slice(0, useMatch.index).split('\n').length;
      if (useLine < defLine) {
        issues.push({ type: 'Use before definition', name, line: useLine, severity: 'CRITICAL' });
        break;
      }
    }
  }

  // Remote defined but unused
  const remoteDefRegex = /local\s+(\w+)\s*=\s*[\w.]+\s*:\s*WaitForChild\s*\(\s*["']([^"']+)["']\s*\)/g;
  let remoteMatch;
  while ((remoteMatch = remoteDefRegex.exec(source)) !== null) {
    const varName = remoteMatch[1];
    if (!source.includes(`${varName}:Fire`) && !source.includes(`${varName}:Invoke`) && !source.includes(`${varName}.On`)) {
      issues.push({ type: 'Defined but unused remote', name: varName, line: source.slice(0, remoteMatch.index).split('\n').length, severity: 'MEDIUM' });
    }
  }

  // Loop integrity
  const loopRegex = /taskSpawn\s*\(\s*function\s*\(\s*\)/g;
  let loopMatch;
  while ((loopMatch = loopRegex.exec(source)) !== null) {
    const context = source.slice(loopMatch.index, Math.min(source.length, loopMatch.index + 800));
    if (!/while\s+/.test(context)) {
      issues.push({ type: 'taskSpawn without while loop', line: source.slice(0, loopMatch.index).split('\n').length, severity: 'HIGH' });
    }
    if (/while\s+/.test(context) && !/task\.wait/.test(context)) {
      issues.push({ type: 'Loop without task.wait', line: source.slice(0, loopMatch.index).split('\n').length, severity: 'CRITICAL' });
    }
  }

  // Character lifecycle
  if (/HumanoidRootPart/.test(source) && !/CharacterAdded/.test(source)) {
    issues.push({ type: 'No CharacterAdded rebind for HumanoidRootPart', line: 1, severity: 'HIGH' });
  }

  const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
  const highCount = issues.filter(i => i.severity === 'HIGH').length;
  const score = Math.max(0, 100 - criticalCount * 20 - highCount * 10);

  let verdict = 'PASS';
  if (criticalCount > 0) verdict = 'FAIL';
  else if (highCount > 3) verdict = 'RISKY';
  else if (highCount > 0) verdict = 'WARN';

  return { issues: issues.slice(0, 20), issueCount: issues.length, score, verdict };
}

function runCompatCheck(source, lines) {
  const apis = [
    { name: 'getgenv', universal: false, supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'] },
    { name: 'writefile', universal: false, supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'] },
    { name: 'request', universal: false, supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'] },
    { name: 'hookfunction', universal: false, supportedBy: ['ScriptWare', 'Fluxus', 'Delta'] },
    { name: 'Drawing', universal: false, supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'] },
    { name: 'setclipboard', universal: false, supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'] },
  ];

  const executors = ['ScriptWare', 'Fluxus', 'Delta', 'Codex', 'Hydrogen'];
  const scores = {};

  for (const exec of executors) {
    let supported = 0;
    let total = 0;
    for (const api of apis) {
      const regex = new RegExp(api.name, 'i');
      if (regex.test(source)) {
        total++;
        if (api.universal || (api.supportedBy && api.supportedBy.includes(exec))) supported++;
      }
    }
    scores[exec] = total > 0 ? Math.round((supported / total) * 100) : 100;
  }

  const minScore = Math.min(...Object.values(scores));
  let verdict = 'UNIVERSAL';
  if (minScore < 50) verdict = 'INCOMPATIBLE';
  else if (minScore < 80) verdict = 'LIMITED';
  else if (minScore < 100) verdict = 'PARTIAL';

  return { scores, verdict, minScore };
}

// ─── Helpers ───

function extractAllRemoteCalls(source) {
  const calls = [];
  const regex = /([\w.]+)\s*:\s*(FireServer|InvokeServer|FireClient|FireAllClients|InvokeClient)\s*\(/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const line = source.slice(0, match.index).split('\n').length;
    const context = source.slice(Math.max(0, match.index - 100), match.index + match[0].length + 100);
    calls.push({ remote: match[1], method: match[2], line, pcallWrapped: /pcall|pcallRef/.test(context) });
  }
  return calls;
}

function findLoopRanges(source, lines) {
  const loops = [];
  const taskSpawnRegex = /taskSpawn\s*\(\s*function/g;
  let match;
  while ((match = taskSpawnRegex.exec(source)) !== null) {
    const startLine = source.slice(0, match.index).split('\n').length;
    loops.push({ startLine, endLine: startLine + 200 }); // Approximate
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

function computeScores(checks) {
  return {
    regressionGate: checks.regressionGate.verdict === 'PASS' ? 100 : checks.regressionGate.verdict === 'WARN' ? 70 : 30,
    security: checks.securityScan.verdict === 'CLEAN' ? 100 : checks.securityScan.verdict === 'WARN' ? 60 : 20,
    complexity: 100 - Math.min(80, checks.complexity.maxComplexity * 2),
    perfProfile: checks.perfProfile.score,
    pcallSafety: checks.pcallAudit.protectionRate,
    deadCode: 100 - checks.deadCode.deadPercent * 3,
    dataFlow: checks.verifyFlow.score,
    compatibility: checks.compatCheck.minScore,
  };
}

// ─── Renderers ───

export function renderSnapshotJSON(result) {
  return JSON.stringify(result, null, 2);
}

export function renderSnapshotSummary(result) {
  if (result.error) return `[LUAU SNAPSHOT] ERROR\n${result.error}`;

  const lines = [];
  lines.push(`[LUAU SNAPSHOT] ${result.fileName}`);
  lines.push(`Timestamp: ${result.timestamp}`);
  lines.push(`Lines: ${result.totalLines} | Size: ${formatBytes(result.fileSize)}`);
  lines.push(`MD5: ${result.checksum.md5}`);
  lines.push('');

  lines.push('── Check Results ─────────────────────────────────');
  const severityIcon = { PASS: '✅', 'PASS_WITH_WARNINGS': '⚠️', DEGRADED: '⚠️', FAIL: '🔴' };
  const icon = severityIcon[result.verdict] || '❓';
  lines.push(`  Overall: ${icon} ${result.verdict}`);
  lines.push('');

  for (const [name, check] of Object.entries(result.checks)) {
    const checkIcon = check.verdict === 'PASS' || check.verdict === 'CLEAN' || check.verdict === 'SAFE' || check.verdict === 'UNIVERSAL' || check.verdict === 'EXCELLENT'
      ? '✅' : check.verdict === 'WARN' || check.verdict === 'CONDITIONAL' || check.verdict === 'SUSPICIOUS' || check.verdict === 'LIMITED' || check.verdict === 'BELOW_AVG' || check.verdict === 'AVG'
        ? '🟡' : '🔴';
    lines.push(`  ${checkIcon} ${name.padEnd(20)} ${check.verdict}`);
  }
  lines.push('');

  if (Object.keys(result.scores).length > 0) {
    lines.push('── Scores ──────────────────────────────────────');
    for (const [name, score] of Object.entries(result.scores)) {
      const bar = '█'.repeat(Math.max(1, Math.round(score / 5))) + '░'.repeat(20 - Math.max(1, Math.round(score / 5)));
      lines.push(`  ${name.padEnd(20)} [${bar}] ${score}`);
    }
    lines.push('');
  }

  lines.push(`Summary: ${result.summary.passed} passed, ${result.summary.warned} warnings, ${result.summary.blocked} blocked`);
  lines.push('');

  return lines.join('\n');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
