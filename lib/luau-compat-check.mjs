#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau Compat Check — Executor Compatibility
// ──────────────────────────────────────────────
// Scans a Luau script and generates a
// compatibility matrix across executors:
// ScriptWare, Fluxus, Delta, Codex, Hydrogen.
// Detects non-universal APIs and recommends
// safe fallback chains.

export function runLuauCompatCheck(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');

  // Detect API usage
  const apiUsage = detectAPIUsage(source, lines);

  // Check executor support for each API
  const compatMatrix = buildCompatMatrix(apiUsage);

  // Find incompatibilities
  const incompatibilities = findIncompatibilities(apiUsage, compatMatrix);

  // Recommend fallback chains
  const fallbackChains = recommendFallbacks(apiUsage);

  // Score per executor
  const executorScores = computeExecutorScores(apiUsage, compatMatrix);

  // Overall verdict
  const unsupported = incompatibilities.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH');
  let overallVerdict;
  if (unsupported.length > 5) overallVerdict = 'INCOMPATIBLE';
  else if (unsupported.length > 2) overallVerdict = 'LIMITED';
  else if (unsupported.length > 0) overallVerdict = 'PARTIAL';
  else overallVerdict = 'UNIVERSAL';

  return {
    fileName: path.basename(filePath),
    filePath: absPath,
    totalLines: lines.length,
    apiUsage,
    compatMatrix,
    incompatibilities,
    fallbackChains,
    executorScores,
    overallVerdict,
    summary: {
      totalAPIs: apiUsage.length,
      universalAPIs: apiUsage.filter(a => a.universal).length,
      nonUniversalAPIs: apiUsage.filter(a => !a.universal).length,
      criticalIssues: incompatibilities.filter(i => i.severity === 'CRITICAL').length,
      highIssues: incompatibilities.filter(i => i.severity === 'HIGH').length,
      mediumIssues: incompatibilities.filter(i => i.severity === 'MEDIUM').length,
      lowIssues: incompatibilities.filter(i => i.severity === 'LOW').length,
    },
  };
}

// ─── API Detection ───

function detectAPIUsage(source, lines) {
  const apis = [
    // Universal APIs (supported by all major executors)
    { name: 'loadstring', universal: true, regex: /loadstring\s*\(/, description: 'Dynamic code loading' },
    { name: 'game.HttpGet', universal: true, regex: /game\s*:\s*HttpGet\s*\(/, description: 'HTTP GET via Roblox' },
    { name: 'task.spawn', universal: true, regex: /task\.spawn\s*\(/, description: 'Thread spawning (Luau)' },
    { name: 'task.wait', universal: true, regex: /task\.wait\s*\(/, description: 'Timed wait (Luau)' },
    { name: 'pcall', universal: true, regex: /\bpcall\s*\(/, description: 'Protected call' },
    { name: 'xpcall', universal: true, regex: /\bxpcall\s*\(/, description: 'Extended protected call' },

    // Near-universal (most executors)
    { name: 'getgenv', universal: false, regex: /getgenv\s*\(\s*\)/, description: 'Global environment', supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'], notSupported: ['Codex'] },
    { name: 'setclipboard', universal: false, regex: /setclipboard\s*\(/, description: 'Clipboard access', supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'], notSupported: ['Codex'] },
    { name: 'writefile', universal: false, regex: /writefile\s*\(/, description: 'File writing', supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'], notSupported: ['Codex'] },
    { name: 'readfile', universal: false, regex: /readfile\s*\(/, description: 'File reading', supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'], notSupported: ['Codex'] },
    { name: 'isfile', universal: false, regex: /isfile\s*\(/, description: 'File existence check', supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'], notSupported: ['Codex'] },

    // HTTP APIs (varies by executor)
    { name: 'request', universal: false, regex: /request\s*\(/, description: 'HTTP request (universal method)', supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'], notSupported: ['Codex'] },
    { name: 'http.request', universal: false, regex: /http\.request\s*\(/, description: 'HTTP request (http lib)', supportedBy: ['ScriptWare', 'Fluxus', 'Delta'], notSupported: ['Codex', 'Hydrogen'] },

    // Advanced APIs
    { name: 'hookfunction', universal: false, regex: /hookfunction\s*\(/, description: 'Function hooking', supportedBy: ['ScriptWare', 'Fluxus', 'Delta'], notSupported: ['Codex', 'Hydrogen'] },
    { name: 'Drawing.new', universal: false, regex: /Drawing\.new\s*\(/, description: '2D drawing API', supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'], notSupported: ['Codex'] },
    { name: 'isexecutorclosure', universal: false, regex: /isexecutorclosure\s*\(/, description: 'Closure detection', supportedBy: ['ScriptWare', 'Fluxus', 'Delta'], notSupported: ['Codex', 'Hydrogen'] },
    { name: 'identifyexecutor', universal: false, regex: /identifyexecutor\s*\(\s*\)/, description: 'Executor identification', supportedBy: ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen'], notSupported: ['Codex'] },
    { name: 'queue_on_teleport', universal: false, regex: /queue_on_teleport\s*\(/, description: 'Script queue on teleport', supportedBy: ['ScriptWare', 'Fluxus', 'Delta'], notSupported: ['Codex', 'Hydrogen'] },
    { name: 'crypt.encrypt', universal: false, regex: /crypt\.encrypt/, description: 'Encryption API', supportedBy: ['ScriptWare'], notSupported: ['Fluxus', 'Delta', 'Codex', 'Hydrogen'] },
  ];

  const detected = [];

  for (const api of apis) {
    const regex = new RegExp(api.regex.source, api.regex.flags);
    const matches = source.match(regex);
    if (matches && matches.length > 0) {
      detected.push({
        ...api,
        usageCount: matches.length,
        lines: findAPILines(source, api.regex),
      });
    }
  }

  return detected;
}

function findAPILines(source, regex) {
  const lines = [];
  const re = new RegExp(regex.source, regex.flags);
  let match;
  while ((match = re.exec(source)) !== null) {
    lines.push(source.slice(0, match.index).split('\n').length);
  }
  return lines;
}

// ─── Compatibility Matrix ───

function buildCompatMatrix(apiUsage) {
  const executors = ['ScriptWare', 'Fluxus', 'Delta', 'Codex', 'Hydrogen'];
  const matrix = {};

  for (const executor of executors) {
    matrix[executor] = {
      supported: 0,
      unsupported: 0,
      apis: [],
      score: 0,
    };
  }

  for (const api of apiUsage) {
    for (const executor of executors) {
      const isSupported = api.universal || (api.supportedBy && api.supportedBy.includes(executor));
      if (isSupported) {
        matrix[executor].supported++;
        matrix[executor].apis.push({ name: api.name, status: '✅' });
      } else {
        matrix[executor].unsupported++;
        matrix[executor].apis.push({ name: api.name, status: '❌' });
      }
    }
  }

  return matrix;
}

// ─── Incompatibilities ───

function findIncompatibilities(apiUsage, compatMatrix) {
  const incompatibilities = [];

  for (const api of apiUsage) {
    if (api.universal) continue;

    const notSupported = api.notSupported || [];
    for (const executor of notSupported) {
      let severity;
      if (api.usageCount > 5) severity = 'CRITICAL';
      else if (api.usageCount > 1) severity = 'HIGH';
      else severity = 'MEDIUM';

      incompatibilities.push({
        severity,
        api: api.name,
        executor,
        description: api.description,
        usageCount: api.usageCount,
        lines: api.lines,
        detail: `${api.name} used ${api.usageCount} time(s) — not supported on ${executor}`,
      });
    }
  }

  return incompatibilities.sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (order[a.severity] || 4) - (order[b.severity] || 4);
  });
}

// ─── Fallback Recommendations ───

function recommendFallbacks(apiUsage) {
  const chains = [];

  // loadstring + request fallback
  if (apiUsage.find(a => a.name === 'request') && !apiUsage.find(a => a.name === 'loadstring')) {
    chains.push({
      pattern: 'HTTP request',
      chain: 'request() → game:HttpGet() → loadstring(game:HttpGet(url))()',
      description: 'Use request() first, fall back to HttpGet for URL fetching',
    });
  }

  // getgenv fallback
  if (apiUsage.find(a => a.name === 'getgenv')) {
    chains.push({
      pattern: 'Global environment',
      chain: 'getgenv() → shared → module-level variable',
      description: 'Use getgenv() with fallback to shared table',
    });
  }

  // file API fallback
  if (apiUsage.find(a => a.name === 'writefile') || apiUsage.find(a => a.name === 'readfile')) {
    chains.push({
      pattern: 'File operations',
      chain: 'writefile()/readfile() → in-memory cache → skip',
      description: 'File APIs not available on Codex — use memory or skip',
    });
  }

  // Drawing API fallback
  if (apiUsage.find(a => a.name === 'Drawing.new')) {
    chains.push({
      pattern: 'ESP/Drawing',
      chain: 'Drawing.new() → BillboardGui → TextLabel → skip',
      description: 'Use BillboardGui as fallback for 2D drawing on Codex',
    });
  }

  // hookfunction fallback
  if (apiUsage.find(a => a.name === 'hookfunction')) {
    chains.push({
      pattern: 'Function hooking',
      chain: 'hookfunction() → original function replacement → skip',
      description: 'hookfunction not available on Codex/Hydrogen',
    });
  }

  return chains;
}

// ─── Executor Scores ───

function computeExecutorScores(apiUsage, compatMatrix) {
  const scores = {};

  for (const [executor, data] of Object.entries(compatMatrix)) {
    const total = data.supported + data.unsupported;
    scores[executor] = {
      score: total > 0 ? Math.round((data.supported / total) * 100) : 100,
      supported: data.supported,
      unsupported: data.unsupported,
      total,
    };
  }

  return scores;
}

// ─── Renderers ───

export function renderLuauCompatCheck(result) {
  if (result.error) {
    return `[LUAU COMPAT CHECK] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push(`[LUAU COMPAT CHECK] ${result.fileName}`);
  lines.push('═'.repeat(52));
  lines.push(`  Total lines:     ${result.totalLines}`);
  lines.push(`  APIs detected:   ${result.apiUsage.length}`);
  lines.push(`  Universal APIs:  ${result.summary.universalAPIs}`);
  lines.push(`  Non-universal:   ${result.summary.nonUniversalAPIs}`);
  lines.push(`  Overall verdict: ${result.overallVerdict}`);
  lines.push('');

  // Executor scores
  lines.push('── Executor Compatibility ──────────────────────');
  lines.push('');
  lines.push('| Executor | Score | Supported | Missing |');
  lines.push('|----------|-------|-----------|---------|');

  const executorOrder = ['ScriptWare', 'Fluxus', 'Delta', 'Hydrogen', 'Codex'];
  for (const exec of executorOrder) {
    if (result.executorScores[exec]) {
      const s = result.executorScores[exec];
      const icon = s.score >= 90 ? '✅' : s.score >= 70 ? '⚠️' : '❌';
      lines.push(`| ${exec.padEnd(12)} | ${s.score}%   | ${s.supported}         | ${s.unsupported}       | ${icon}`);
    }
  }
  lines.push('');

  // API usage table
  if (result.apiUsage.length > 0) {
    lines.push('── API Usage ───────────────────────────────────');
    lines.push('');
    lines.push('| # | API | Universal | Usage | Lines |');
    lines.push('|---|-----|-----------|-------|-------|');
    for (let i = 0; i < result.apiUsage.length; i++) {
      const a = result.apiUsage[i];
      const uni = a.universal ? '✅' : '❌';
      const lineStr = a.lines.slice(0, 3).join(', ') + (a.lines.length > 3 ? ` (+${a.lines.length - 3})` : '');
      lines.push(`| ${i + 1} | ${a.name.padEnd(20)} | ${uni} | ${a.usageCount} | ${lineStr} |`);
    }
    lines.push('');
  }

  // Incompatibilities
  if (result.incompatibilities.length > 0) {
    lines.push(`── Incompatibilities (${result.incompatibilities.length}) ────────────`);
    lines.push('');
    lines.push('| # | API | Executor | Severity | Usage | Detail |');
    lines.push('|---|-----|----------|----------|-------|--------|');

    const severityIcon = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' };
    for (let i = 0; i < result.incompatibilities.length; i++) {
      const inc = result.incompatibilities[i];
      lines.push(`| ${i + 1} | ${inc.api.padEnd(20)} | ${inc.executor.padEnd(12)} | ${severityIcon[inc.severity]} ${inc.severity.padEnd(8)} | ${inc.usageCount} | ${inc.detail.slice(0, 50)} |`);
    }
    lines.push('');
  }

  // Fallback chains
  if (result.fallbackChains.length > 0) {
    lines.push('── Recommended Fallback Chains ───────────────');
    for (const fc of result.fallbackChains) {
      lines.push(`  📦 ${fc.pattern}`);
      lines.push(`     Chain:  ${fc.chain}`);
      lines.push(`     Reason: ${fc.description}`);
      lines.push('');
    }
  }

  lines.push('═'.repeat(52));
  lines.push(`  Verdict: ${result.overallVerdict}`);
  lines.push(`  Critical: ${result.summary.criticalIssues} | High: ${result.summary.highIssues} | Medium: ${result.summary.mediumIssues}`);
  lines.push('═'.repeat(52));

  return lines.join('\n');
}
