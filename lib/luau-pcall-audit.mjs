#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau Pcall Audit — Remote Safety Scanner
// ──────────────────────────────────────────────

export function runLuauPcallAudit(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { fileName: path.basename(filePath), error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');

  // Find all remote calls
  const allCalls = extractAllRemoteCalls(source, lines);

  // Categorize by protection status
  const protected_ = [];
  const unprotected = [];
  const ambiguous = [];

  for (const call of allCalls) {
    if (call.pcallWrapped) {
      protected_.push(call);
    } else if (call.ambiguous) {
      ambiguous.push(call);
    } else {
      unprotected.push(call);
    }
  }

  // Risk scoring
  const riskByRemote = calculateRiskByRemote(unprotected, allCalls);

  // Loop analysis: unprotected calls inside loops
  const loopUnprotected = unprotected.filter(c => c.inLoop && !c.hasTaskWait);
  const loopProtected = protected_.filter(c => c.inLoop);

  // Verdict
  let verdict;
  const criticalUnprotected = unprotected.filter(c =>
    c.method === 'FireServer' || c.method === 'InvokeServer'
  );

  if (criticalUnprotected.length > 5) verdict = 'CRITICAL';
  else if (criticalUnprotected.length > 0) verdict = 'HIGH';
  else if (ambiguous.length > 0) verdict = 'MEDIUM';
  else verdict = 'SAFE';

  return {
    fileName: path.basename(filePath),
    filePath: absPath,
    totalCalls: allCalls.length,
    protected: protected_.length,
    unprotected: unprotected.length,
    ambiguous: ambiguous.length,
    protectionRate: allCalls.length > 0
      ? Math.round((protected_.length / allCalls.length) * 100)
      : 100,
    protectedCalls: protected_,
    unprotectedCalls: unprotected,
    ambiguousCalls: ambiguous,
    loopUnprotected,
    loopProtected,
    riskByRemote,
    verdict,
  };
}

// ─── Remote Call Extraction ───

function extractAllRemoteCalls(source, lines) {
  const calls = [];
  const regex = /([\w.]+)\s*:\s*(FireServer|InvokeServer|FireClient|FireAllClients|InvokeClient)\s*\(/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const lineNum = source.slice(0, match.index).split('\n').length;
    const window = getWindow(source, match.index, 150, 200);

    const pcallWrapped = detectPcallWrap(window, source, match.index);
    const inLoop = detectInLoop(window, lines, lineNum);
    const hasTaskWait = /task\.wait/.test(window.before);
    const inFunction = detectInFunction(lines, lineNum);
    const inCallback = /Callback\s*=/.test(window.before);
    const debounce = /debounce|cooldown/.test(window.before + window.after);

    // Determine if ambiguous (wrapped in something that might handle errors)
    const ambiguous = !pcallWrapped && (
      /task\.spawn\s*\(\s*function/.test(window.before) ||
      /:andThen\(|:catch\(/.test(window.after) ||
      /wrapFunction|safeCall|safeFire/.test(window.before)
    );

    calls.push({
      remote: match[1],
      method: match[2],
      line: lineNum,
      pcallWrapped,
      ambiguous,
      inLoop,
      hasTaskWait,
      inFunction,
      inCallback,
      debounce,
      context: window.before.slice(-80) + match[0] + window.after.slice(0, 80),
    });
  }

  return calls;
}

function detectPcallWrap(window, source, matchIndex) {
  // Check 100 chars before call for pcall/pcallRef/xpcall
  const before = window.before;
  if (/pcall\s*\(/.test(before)) return true;
  if (/pcallRef\s*\(/.test(before)) return true;
  if (/xpcall\s*\(/.test(before)) return true;

  // Check if inside a function that itself is pcall-wrapped
  // Look for pattern: pcall(function() ... FireServer
  const pcallFuncMatch = before.match(/pcall\s*\(\s*function\s*\(\)\s*\n([\s\S]{0,500})$/);
  if (pcallFuncMatch) return true;

  return false;
}

function detectInLoop(window, lines, lineNum) {
  // Check if we're inside a while or for loop
  const beforeLines = lines.slice(0, lineNum - 1);
  let depth = 0;

  for (let i = beforeLines.length - 1; i >= 0; i--) {
    const line = beforeLines[i];
    if (/^\s*(while|for)\b/.test(line)) {
      depth++;
      if (depth === 1) return true;
    }
    if (/^\s*end\b/.test(line)) {
      depth--;
    }
  }

  return false;
}

function detectInFunction(lines, lineNum) {
  for (let i = lineNum - 1; i >= Math.max(0, lineNum - 5); i--) {
    if (/^\s*(local\s+)?function\s+\w+/.test(lines[i])) return true;
  }
  return false;
}

// ─── Risk Calculation ───

function calculateRiskByRemote(unprotected, allCalls) {
  const map = new Map();

  for (const call of unprotected) {
    const key = `${call.remote}:${call.method}`;
    if (!map.has(key)) {
      map.set(key, {
        remote: call.remote,
        method: call.method,
        unprotectedCount: 0,
        totalCount: allCalls.filter(c => c.remote === call.remote && c.method === call.method).length,
        lines: [],
        inLoop: false,
        riskScore: 0,
      });
    }
    const entry = map.get(key);
    entry.unprotectedCount++;
    entry.lines.push(call.line);
    if (call.inLoop) entry.inLoop = true;
  }

  // Calculate risk score
  for (const entry of map.values()) {
    let score = 0;

    // Base: unprotected count * weight
    switch (entry.method) {
      case 'FireServer': score += entry.unprotectedCount * 10; break;
      case 'InvokeServer': score += entry.unprotectedCount * 15; break;
      case 'FireClient': score += entry.unprotectedCount * 5; break;
      case 'InvokeClient': score += entry.unprotectedCount * 8; break;
      case 'FireAllClients': score += entry.unprotectedCount * 7; break;
    }

    // Multiplier for loops
    if (entry.inLoop) score = Math.round(score * 1.5);

    entry.riskScore = score;
  }

  return Array.from(map.values()).sort((a, b) => b.riskScore - a.riskScore);
}

// ─── Helpers ───

function getWindow(source, index, beforeRange, afterRange) {
  const start = Math.max(0, index - beforeRange);
  const end = Math.min(source.length, index + afterRange);
  return {
    before: source.slice(start, index),
    after: source.slice(index, end),
  };
}

// ─── Renderer ───

export function renderLuauPcallAudit(result) {
  if (result.error) {
    return `[LUAU PCALL AUDIT] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push(`[LUAU PCALL AUDIT] ${result.fileName}`);
  lines.push('═'.repeat(52));
  lines.push('');
  lines.push(`  Total remote calls:    ${result.totalCalls}`);
  lines.push(`  Protected (pcall):     ${result.protected}`);
  lines.push(`  Unprotected:           ${result.unprotected}`);
  lines.push(`  Ambiguous:             ${result.ambiguous}`);
  lines.push(`  Protection rate:       ${result.protectionRate}%`);
  lines.push('');

  // Unprotected calls detail
  if (result.unprotectedCalls.length > 0) {
    lines.push('── Unprotected Remote Calls ──────────────────────');
    lines.push('');
    lines.push('| # | Remote | Method | Line | Context | Risk |');
    lines.push('|---|--------|--------|------|---------|------|');

    for (let i = 0; i < result.unprotectedCalls.length; i++) {
      const call = result.unprotectedCalls[i];
      const loopTag = call.inLoop ? ' [LOOP]' : '';
      const fnTag = call.inFunction ? ' [FN]' : '';
      const cbTag = call.inCallback ? ' [CB]' : '';
      const tags = `${loopTag}${fnTag}${cbTag}`;

      const methodSeverity = call.method === 'InvokeServer' ? '🔴' :
                             call.method === 'FireServer' ? '🟠' : '🟡';

      lines.push(`| ${i + 1} | ${methodSeverity} ${call.remote} | ${call.method} | ${call.line} |${tags} | ${call.inLoop ? 'HIGH' : 'MED'} |`);
    }
    lines.push('');
  }

  // Loop-specific analysis
  if (result.loopUnprotected.length > 0) {
    lines.push('── ⚠️  Unprotected in Loop (CRITICAL) ───────────');
    for (const call of result.loopUnprotected) {
      lines.push(`  🔴 ${call.remote}:${call.method} at line ${call.line}`);
    }
    lines.push('');
  }

  // Ambiguous calls
  if (result.ambiguousCalls.length > 0) {
    lines.push('── Ambiguous (Review Needed) ───────────────────');
    for (const call of result.ambiguousCalls) {
      lines.push(`  🟡 ${call.remote}:${call.method} at line ${call.line} — may have custom error handling`);
    }
    lines.push('');
  }

  // Risk by remote
  if (result.riskByRemote.length > 0) {
    lines.push('── Risk by Remote ──────────────────────────────');
    lines.push('');
    lines.push('| Remote | Method | Unprotected | Total | Loop | Risk |');
    lines.push('|--------|--------|-------------|-------|------|------|');

    for (const entry of result.riskByRemote) {
      const severity = entry.riskScore > 30 ? '🔴' : entry.riskScore > 15 ? '🟠' : '🟡';
      lines.push(`| ${entry.remote} | ${entry.method} | ${entry.unprotectedCount} | ${entry.totalCount} | ${entry.inLoop ? '⚠️' : '—'} | ${severity} ${entry.riskScore} |`);
    }
    lines.push('');
  }

  // Protected calls summary
  if (result.protectedCalls.length > 0) {
    lines.push(`── ✅ Protected Calls (${result.protected}) ────────────────`);
    lines.push(`  All ${result.protected} calls are properly pcall-wrapped.`);
    lines.push('');
  }

  lines.push('═'.repeat(52));
  lines.push(`  Verdict: ${result.verdict}`);
  lines.push('═'.repeat(52));

  return lines.join('\n');
}
