#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ──────────────────────────────────────────────
// Luau Baseline — Feature Baseline Generator
// ──────────────────────────────────────────────
// Combines inspect + symbol-map + remote-map +
// feature extraction into a single authoritative
// markdown document. This is the mandatory step-0
// before any migration, refactor, or repair.

export function runLuauBaseline(filePath, options = {}) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');
  const fileName = path.basename(absPath);

  // Checksum
  const md5 = crypto.createHash('md5').update(source).digest('hex');
  const sha256 = crypto.createHash('sha256').update(source).digest('hex');

  // Extract all baseline components
  const meta = extractMeta(absPath, source, lines);
  const features = extractFeatures(source, lines);
  const remotes = extractRemotes(source, lines);
  const functions = extractFunctions(source, lines);
  const stateTables = extractStateTables(source, lines);
  const loops = extractLoops(source, lines);
  const events = extractEvents(source, lines);
  const lifecycle = extractLifecycle(source, lines);
  const config = extractConfig(source, lines);
  const executorAPI = extractExecutorAPI(source, lines);
  const uiStructure = extractUIStructure(source, lines);

  // Feature completeness proof
  const featureProof = buildFeatureProof(features, remotes, loops, functions);

  // Risk assessment
  const riskAssessment = assessRisk(remotes, loops, lifecycle, source);

  return {
    fileName,
    filePath: absPath,
    generatedAt: new Date().toISOString(),
    checksum: { md5, sha256 },
    meta,
    features,
    featureProof,
    remotes,
    functions,
    stateTables,
    loops,
    events,
    lifecycle,
    config,
    executorAPI,
    uiStructure,
    riskAssessment,
  };
}

// ─── Meta ───

function extractMeta(absPath, source, lines) {
  return {
    fileName: path.basename(absPath),
    fileSize: fs.statSync(absPath).size,
    totalLines: lines.length,
    framework: detectFramework(source),
    loadMethod: detectLoadMethod(source),
    executorCompat: detectExecutorCompat(source),
  };
}

function detectFramework(source) {
  if (/LibSixtyTen|createLibSixtyTen/.test(source)) return 'LibSixtyTen';
  if (/Obsidian|obsidian\.luau/.test(source)) return 'Obsidian';
  if (/Orion/.test(source)) return 'Orion';
  if (/Fluent/.test(source)) return 'Fluent';
  if (/RayField/.test(source)) return 'RayField';
  if (/loadstring/.test(source)) return 'Custom (loadstring)';
  return 'Inline (no external load)';
}

function detectLoadMethod(source) {
  if (/loadstring.*game:HttpGet/.test(source)) return 'loadstring + HttpGet';
  if (/loadstring.*request/.test(source)) return 'loadstring + request';
  if (/require\s*\(\d+\)/.test(source)) return 'require (numeric ID)';
  if (/require/.test(source)) return 'require (path)';
  return 'Inline';
}

function detectExecutorCompat(source) {
  const api = [];
  if (/loadstring/.test(source)) api.push('loadstring');
  if (/getgenv/.test(source)) api.push('getgenv');
  if (/setclipboard/.test(source)) api.push('setclipboard');
  if (/writefile/.test(source)) api.push('writefile');
  if (/readfile/.test(source)) api.push('readfile');
  if (/isfile/.test(source)) api.push('isfile');
  if (/request\(|httpRequest/.test(source)) api.push('request');
  if (/hookfunction/.test(source)) api.push('hookfunction');
  if (/isexecutorclosure|identifyexecutor/.test(source)) api.push('detection');
  if (/Drawing/.test(source)) api.push('Drawing');
  if (/syn\.protect|crypt/.test(source)) api.push('encryption');
  return api.length > 0 ? api : ['Standard Lua'];
}

// ─── Features ───

function extractFeatures(source, lines) {
  const features = [];
  const patterns = [
    { regex: /BuildToggle\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["'][^}]*Default\s*=\s*(true|false)/gi, type: 'Toggle' },
    { regex: /BuildToggle\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'Toggle' },
    { regex: /CreateToggle\s*\(\s*\{[^}]*Name\s*=\s*["']([^"']+)["'][^}]*Default\s*=\s*(true|false)/gi, type: 'Toggle' },
    { regex: /CreateToggle\s*\(\s*\{[^}]*Name\s*=\s*["']([^"']+)["']/gi, type: 'Toggle' },
    { regex: /BuildDropdown\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'Dropdown' },
    { regex: /BuildSlider\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["'][^}]*Default\s*=\s*(\d+)/gi, type: 'Slider' },
    { regex: /BuildButton\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'Button' },
    { regex: /BuildLabel\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'Label' },
    { regex: /BuildKeybind\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'Keybind' },
    { regex: /BuildTextbox\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'Textbox' },
  ];

  for (const p of patterns) {
    const regex = new RegExp(p.regex.source, p.regex.flags);
    let match;
    while ((match = regex.exec(source)) !== null) {
      const feature = {
        type: p.type,
        name: match[1],
        line: source.slice(0, match.index).split('\n').length,
      };
      if (match[2] !== undefined) {
        feature.default = p.type === 'Toggle' ? match[2] === 'true' : parseInt(match[2]);
      }
      features.push(feature);
    }
  }

  return features;
}

// ─── Remotes ───

function extractRemotes(source, lines) {
  const remotes = [];

  // Definitions
  const defRegex = /local\s+(\w+)\s*=\s*([\w.]+)\s*:\s*(WaitForChild|FindFirstChild)\s*\(\s*["']([^"']+)["']\s*\)/g;
  let match;
  while ((match = defRegex.exec(source)) !== null) {
    remotes.push({
      varName: match[1],
      parentPath: match[2],
      remoteName: match[4],
      method: match[3],
      line: source.slice(0, match.index).split('\n').length,
      isDefinition: true,
      calls: [],
      events: [],
    });
  }

  // Calls per remote
  for (const remote of remotes) {
    const callRegex = new RegExp(`\\b${remote.varName}\\s*:\\s*(FireServer|InvokeServer|FireClient|FireAllClients|InvokeClient)\\s*\\(`, 'g');
    let cm;
    while ((cm = callRegex.exec(source)) !== null) {
      const line = source.slice(0, cm.index).split('\n').length;
      const context = source.slice(Math.max(0, cm.index - 100), cm.index + cm[0].length + 100);
      const pcallWrapped = /pcall|pcallRef|xpcall/.test(context);
      remote.calls.push({ line, method: cm[1], pcallWrapped });
    }
  }

  // Events
  for (const remote of remotes) {
    const eventRegex = new RegExp(`\\b${remote.varName}\\s*\\.\\s*(OnServerEvent|OnClientEvent|OnServerInvoke|OnClientInvoke)\\s*:\\s*Connect`, 'g');
    let em;
    while ((em = eventRegex.exec(source)) !== null) {
      remote.events.push({
        eventType: em[1],
        line: source.slice(0, em.index).split('\n').length,
      });
    }
  }

  return remotes;
}

// ─── Functions ───

function extractFunctions(source, lines) {
  const functions = [];
  const regex = /(?:local\s+function\s+(\w+)|local\s+(\w+)\s*=\s*function)\s*\(([^)]*)\)/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const name = match[1] || match[2];
    const params = match[3]?.split(',').map(p => p.trim()).filter(Boolean) || [];
    const line = source.slice(0, match.index).split('\n').length;
    const endLine = findFuncEnd(lines, line - 1);
    const body = lines.slice(line - 1, endLine).join('\n');

    const remoteCalls = [...new Set((body.match(/([\w.]+)\s*:\s*(FireServer|InvokeServer)/g) || []))];
    const hasPcall = /pcall|pcallRef/.test(body);
    const isLoop = /taskSpawn|while\s+/.test(body);
    const complexity = computeComplexity(body);

    functions.push({ name, params, line, lineCount: endLine - line + 1, remoteCalls, hasPcall, isLoop, complexity });
  }
  return functions.sort((a, b) => a.line - b.line);
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

function computeComplexity(body) {
  let c = 1;
  for (const p of [/\bif\b/g, /\belseif\b/g, /\band\b/g, /\bor\b/g, /\bfor\b/g, /\bwhile\b/g]) {
    c += (body.match(p) || []).length;
  }
  return c;
}

// ─── State Tables ───

function extractStateTables(source, lines) {
  const tables = [];
  const regex = /local\s+(Toggles|Options|Config|Settings|State|Defaults|Presets|FarmProfile)\s*=\s*\{/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const name = match[1];
    const line = source.slice(0, match.index).split('\n').length;
    const context = source.slice(match.index, Math.min(source.length, match.index + 3000));
    const keys = [];
    const keyRegex = /\[\s*["']([^"']+)["']\s*\]\s*=|(\w+)\s*=\s*(?!function)/g;
    let km;
    const seen = new Set();
    while ((km = keyRegex.exec(context)) !== null) {
      const key = km[1] || km[2];
      if (key && !seen.has(key) && key.length > 1 && key.length < 40) {
        seen.add(key);
        keys.push(key);
      }
    }
    tables.push({ name, line, keys });
  }
  return tables;
}

// ─── Loops ───

function extractLoops(source, lines) {
  const loops = [];
  const loopRegex = /taskSpawn\s*\(\s*function\s*\(\s*\)/g;
  let match;
  while ((match = loopRegex.exec(source)) !== null) {
    const startLine = source.slice(0, match.index).split('\n').length;
    const endLine = findFuncEnd(lines, startLine - 1);
    const context = source.slice(match.index, Math.min(source.length, match.index + 600));
    const name = inferLoopName(lines, startLine - 1, context);
    const hasWait = /task\.wait/.test(context);
    const hasPcall = /pcall|pcallRef/.test(context);
    const hasWhile = /while\s+/.test(context);
    const intervalMatch = context.match(/task\.wait\(\s*([\d.]+)\s*\)/);
    const interval = intervalMatch ? parseFloat(intervalMatch[1]) : null;

    loops.push({ name, line: startLine, endLine, lineCount: endLine - startLine + 1, hasWait, hasPcall, hasWhile, interval });
  }
  return loops;
}

function inferLoopName(lines, startIdx, context) {
  for (let i = startIdx; i >= Math.max(0, startIdx - 40); i--) {
    const m = lines[i].match(/Title\s*=\s*["']([^"']+)["']/);
    if (m) return `Loop:${m[1]}`;
    const m2 = lines[i].match(/Name\s*=\s*["']([^"']+)["']/);
    if (m2) return `Loop:${m2[1]}`;
    const m3 = lines[i].match(/StartLoop\s*\(\s*["']([^"']+)["']/);
    if (m3) return `Loop:${m3[1]}`;
  }
  return `Loop:${startIdx + 1}`;
}

// ─── Events ───

function extractEvents(source, lines) {
  const events = [];
  const patterns = [
    { regex: /([\w.]+)\.Changed\s*:\s*Connect/g, type: 'Changed' },
    { regex: /([\w.]+)\.MouseButton1Click\s*:\s*Connect/g, type: 'Click' },
    { regex: /([\w.]+)\.CharacterAdded\s*:\s*Connect/g, type: 'CharacterAdded' },
    { regex: /([\w.]+)\.(OnServerEvent|OnClientEvent|OnServerInvoke|OnClientInvoke)\s*:\s*Connect/g, type: 'RemoteEvent' },
  ];
  for (const p of patterns) {
    const regex = new RegExp(p.regex.source, p.regex.flags);
    let match;
    while ((match = regex.exec(source)) !== null) {
      events.push({ type: p.type, target: match[1] || match[2], line: source.slice(0, match.index).split('\n').length });
    }
  }
  return events;
}

// ─── Lifecycle ───

function extractLifecycle(source, lines) {
  return {
    characterAdded: /\.CharacterAdded\s*:\s*Connect/.test(source),
    hasHumanoidRootPart: /HumanoidRootPart/.test(source),
    findFirstChild: /:FindFirstChild\s*\(\s*["']HumanoidRootPart["']\s*\)/.test(source),
    startStopLoop: source.includes('StartLoop') && source.includes('StopLoop'),
    debounce: /debounce|cooldown/.test(source),
    taskSpawnLoops: (source.match(/taskSpawn\s*\(\s*function/g) || []).length,
    whileLoops: (source.match(/^\s*while\s+/gm) || []).length,
  };
}

// ─── Config ───

function extractConfig(source, lines) {
  const folderMatch = source.match(/SetFolder\s*\(\s*["']([^"']+)["']/g);
  const folders = folderMatch ? folderMatch.map(m => m.match(/["']([^"']+)["']/)?.[1]) : [];

  return {
    saveManager: source.includes('SaveManager'),
    themeManager: source.includes('ThemeManager'),
    autoloadConfig: source.includes('LoadAutoloadConfig') || source.includes('load_autoload'),
    configFolders: folders,
    hasSettingsTab: /["']Settings["']/.test(source),
  };
}

// ─── Executor API ───

function extractExecutorAPI(source, lines) {
  const apis = [];
  const patterns = [
    { name: 'loadstring', regex: /loadstring\s*\(/ },
    { name: 'getgenv', regex: /getgenv\s*\(/ },
    { name: 'setclipboard', regex: /setclipboard\s*\(/ },
    { name: 'writefile', regex: /writefile\s*\(/ },
    { name: 'readfile', regex: /readfile\s*\(/ },
    { name: 'isfile', regex: /isfile\s*\(/ },
    { name: 'request', regex: /request\s*\(|httpRequest\s*\(/ },
    { name: 'hookfunction', regex: /hookfunction\s*\(/ },
    { name: 'Drawing', regex: /Drawing\.new\(|:Drawing\(/ },
    { name: 'isexecutorclosure', regex: /isexecutorclosure|identifyexecutor/ },
    { name: 'queue_on_teleport', regex: /queue_on_teleport/ },
  ];
  for (const p of patterns) {
    if (p.regex.test(source)) apis.push(p.name);
  }
  return apis;
}

// ─── UI Structure ───

function extractUIStructure(source, lines) {
  const tabs = [];
  const sections = [];
  let currentTab = null;

  const tabRegex = /AddTab\s*\(\s*["']([^"']+)["']/g;
  let match;
  while ((match = tabRegex.exec(source)) !== null) {
    currentTab = match[1];
    tabs.push({ name: match[1], line: source.slice(0, match.index).split('\n').length });
  }

  const sectionRegex = /BuildSection\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/g;
  while ((match = sectionRegex.exec(source)) !== null) {
    sections.push({ name: match[1], tab: currentTab, line: source.slice(0, match.index).split('\n').length });
  }

  const obsSectionRegex = /CreateSection\s*\(\s*["']([^"']+)["']/g;
  while ((match = obsSectionRegex.exec(source)) !== null) {
    sections.push({ name: match[1], tab: currentTab, line: source.slice(0, match.index).split('\n').length });
  }

  return { tabs, sections };
}

// ─── Feature Proof ───

function buildFeatureProof(features, remotes, loops, functions) {
  // Count features by type
  const byType = {};
  for (const f of features) {
    byType[f.type] = (byType[f.type] || 0) + 1;
  }

  // Count remote safety
  const totalCalls = remotes.reduce((s, r) => s + r.calls.length, 0);
  const protectedCalls = remotes.reduce((s, r) => s + r.calls.filter(c => c.pcallWrapped).length, 0);

  // Loop safety
  const safeLoops = loops.filter(l => l.hasWait).length;
  const pcallLoops = loops.filter(l => l.hasPcall).length;

  return {
    totalFeatures: features.length,
    byType,
    totalRemoteCalls: totalCalls,
    protectedCalls,
    protectionRate: totalCalls > 0 ? Math.round((protectedCalls / totalCalls) * 100) : 100,
    totalLoops: loops.length,
    safeLoops,
    pcallLoops,
    totalFunctions: functions.length,
  };
}

// ─── Risk Assessment ───

function assessRisk(remotes, loops, lifecycle, source) {
  let score = 0;
  const issues = [];

  // Unprotected remote calls
  for (const r of remotes) {
    const unprotected = r.calls.filter(c => !c.pcallWrapped);
    if (unprotected.length > 0) {
      score += unprotected.length * 10;
      issues.push(`${unprotected.length} unprotected call(s) on ${r.varName}`);
    }
  }

  // Loops without wait
  const unsafeLoops = loops.filter(l => !l.hasWait);
  if (unsafeLoops.length > 0) {
    score += unsafeLoops.length * 15;
    issues.push(`${unsafeLoops.length} loop(s) without task.wait`);
  }

  // No character rebind
  if (lifecycle.hasHumanoidRootPart && !lifecycle.characterAdded) {
    score += 20;
    issues.push('No CharacterAdded rebind for HumanoidRootPart');
  }

  score = Math.min(100, score);
  const level = score <= 20 ? 'LOW' : score <= 50 ? 'MEDIUM' : score <= 75 ? 'HIGH' : 'CRITICAL';

  return { score, level, issues };
}

// ─── Markdown Renderer ───

export function renderBaselineMarkdown(baseline) {
  const lines = [];
  const b = baseline;

  lines.push(`# Feature Baseline — ${b.fileName}`);
  lines.push('');
  lines.push(`> Auto-generated by agent-system luau-baseline`);
  lines.push(`> Generated: ${b.generatedAt}`);
  lines.push('');

  // Integrity
  lines.push('## Integrity');
  lines.push('');
  lines.push(`| Property | Value |`);
  lines.push(`|----------|-------|`);
  lines.push(`| File | ${b.meta.fileName} |`);
  lines.push(`| Lines | ${b.meta.totalLines} |`);
  lines.push(`| Size | ${formatBytes(b.meta.fileSize)} |`);
  lines.push(`| MD5 | \`${b.checksum.md5}\` |`);
  lines.push(`| SHA-256 | \`${b.checksum.sha256.slice(0, 16)}…\` |`);
  lines.push(`| UI Framework | ${b.meta.framework} |`);
  lines.push(`| Load Method | ${b.meta.loadMethod} |`);
  lines.push('');

  // Feature Proof Summary
  const fp = b.featureProof;
  lines.push('## Feature Proof');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Features | ${fp.totalFeatures} |`);
  for (const [type, count] of Object.entries(fp.byType)) {
    lines.push(`| ${type} | ${count} |`);
  }
  lines.push(`| Remote Calls | ${fp.totalRemoteCalls} (${fp.protectionRate}% protected) |`);
  lines.push(`| Loops | ${fp.totalLoops} (${fp.safeLoops} safe, ${fp.pcallLoops} pcall-wrapped) |`);
  lines.push(`| Functions | ${fp.totalFunctions} |`);
  lines.push('');

  // Features
  if (b.features.length > 0) {
    lines.push(`## Features (${b.features.length})`);
    lines.push('');
    lines.push('| # | Type | Name | Default | Line |');
    lines.push('|---|------|------|---------|------|');
    for (let i = 0; i < b.features.length; i++) {
      const f = b.features[i];
      lines.push(`| ${i + 1} | ${f.type} | ${f.name} | ${f.default !== undefined ? f.default : '—'} | ${f.line} |`);
    }
    lines.push('');
  }

  // Remotes
  if (b.remotes.length > 0) {
    lines.push(`## Remotes (${b.remotes.length})`);
    lines.push('');
    lines.push('| # | Variable | Name | Calls | Events | Unprotected |');
    lines.push('|---|----------|------|-------|--------|-------------|');
    for (let i = 0; i < b.remotes.length; i++) {
      const r = b.remotes[i];
      const unprotected = r.calls.filter(c => !c.pcallWrapped).length;
      lines.push(`| ${i + 1} | ${r.varName} | ${r.remoteName} | ${r.calls.length} | ${r.events.length} | ${unprotected > 0 ? '❌ ' + unprotected : '✅'} |`);
    }
    lines.push('');

    // Remote call details
    lines.push('### Remote Call Details');
    lines.push('');
    lines.push('| # | Remote | Method | Line | Pcall |');
    lines.push('|---|--------|--------|------|-------|');
    let idx = 1;
    for (const r of b.remotes) {
      for (const c of r.calls) {
        lines.push(`| ${idx++} | ${r.varName} | ${c.method} | ${c.line} | ${c.pcallWrapped ? '✅' : '❌'} |`);
      }
    }
    lines.push('');
  }

  // Functions
  if (b.functions.length > 0) {
    lines.push(`## Functions (${b.functions.length})`);
    lines.push('');
    lines.push('| # | Name | Params | Lines | Complexity | Remote | Pcall | Loop |');
    lines.push('|---|------|--------|-------|------------|--------|-------|------|');
    for (let i = 0; i < b.functions.length; i++) {
      const f = b.functions[i];
      const params = f.params.length > 0 ? f.params.join(', ') : '—';
      const remotes = f.remoteCalls.length > 0 ? f.remoteCalls.join(', ') : '—';
      lines.push(`| ${i + 1} | ${f.name} | ${params} | ${f.lineCount} | ${f.complexity} | ${remotes} | ${f.hasPcall ? '✅' : '—'} | ${f.isLoop ? '🔄' : '—'} |`);
    }
    lines.push('');
  }

  // State Tables
  if (b.stateTables.length > 0) {
    lines.push(`## State Tables (${b.stateTables.length})`);
    lines.push('');
    for (const t of b.stateTables) {
      lines.push(`### ${t.name} (L${t.line})`);
      lines.push(`Keys (${t.keys.length}): ${t.keys.join(', ')}`);
      lines.push('');
    }
  }

  // Loops
  if (b.loops.length > 0) {
    lines.push(`## Loops (${b.loops.length})`);
    lines.push('');
    lines.push('| # | Name | Lines | Wait | Pcall | While | Interval |');
    lines.push('|---|------|-------|------|-------|-------|----------|');
    for (let i = 0; i < b.loops.length; i++) {
      const l = b.loops[i];
      lines.push(`| ${i + 1} | ${l.name} | ${l.lineCount} | ${l.hasWait ? '✅' : '❌'} | ${l.hasPcall ? '✅' : '❌'} | ${l.hasWhile ? '✅' : '❌'} | ${l.interval || '—'} |`);
    }
    lines.push('');
  }

  // Events
  if (b.events.length > 0) {
    lines.push(`## Events (${b.events.length})`);
    lines.push('');
    for (const e of b.events) {
      lines.push(`- ${e.type}: ${e.target} (L${e.line})`);
    }
    lines.push('');
  }

  // Lifecycle
  lines.push('## Lifecycle');
  lines.push('');
  const lc = b.lifecycle;
  lines.push(`| Pattern | Status |`);
  lines.push(`|---------|--------|`);
  lines.push(`| CharacterAdded | ${lc.characterAdded ? '✅' : '❌'} |`);
  lines.push(`| HumanoidRootPart | ${lc.hasHumanoidRootPart ? '✅' : '—'} |`);
  lines.push(`| FindFirstChild HRP | ${lc.findFirstChild ? '✅' : '❌'} |`);
  lines.push(`| Start/Stop Loop | ${lc.startStopLoop ? '✅' : '—'} |`);
  lines.push(`| Debounce | ${lc.debounce ? '✅' : '—'} |`);
  lines.push(`| taskSpawn Loops | ${lc.taskSpawnLoops} |`);
  lines.push(`| While Loops | ${lc.whileLoops} |`);
  lines.push('');

  // Config
  if (b.config.saveManager || b.config.themeManager || b.config.configFolders.length > 0) {
    lines.push('## Configuration');
    lines.push('');
    lines.push(`| System | Status |`);
    lines.push(`|--------|--------|`);
    lines.push(`| SaveManager | ${b.config.saveManager ? '✅' : '❌'} |`);
    lines.push(`| ThemeManager | ${b.config.themeManager ? '✅' : '❌'} |`);
    lines.push(`| Autoload Config | ${b.config.autoloadConfig ? '✅' : '❌'} |`);
    if (b.config.configFolders.length > 0) {
      lines.push(`| Config Folders | ${b.config.configFolders.join(', ')} |`);
    }
    lines.push('');
  }

  // Executor API
  if (b.executorAPI.length > 0) {
    lines.push(`## Executor API (${b.executorAPI.length})`);
    lines.push('');
    lines.push(b.executorAPI.map(a => `- ${a}`).join('\n'));
    lines.push('');
  }

  // Risk Assessment
  const ra = b.riskAssessment;
  lines.push(`## Risk Assessment`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Risk Score | ${ra.score}/100 |`);
  lines.push(`| Risk Level | ${ra.level} |`);
  if (ra.issues.length > 0) {
    lines.push(`| Issues | ${ra.issues.length} |`);
    lines.push('');
    for (const issue of ra.issues) {
      lines.push(`- ⚠️ ${issue}`);
    }
  }
  lines.push('');

  // UI Structure
  if (b.uiStructure.tabs.length > 0 || b.uiStructure.sections.length > 0) {
    lines.push('## UI Structure');
    lines.push('');
    for (const tab of b.uiStructure.tabs) {
      lines.push(`### 📑 ${tab.name}`);
      const tabSections = b.uiStructure.sections.filter(s => s.tab === tab.name);
      for (const sec of tabSections) {
        lines.push(`- 📂 ${sec.name}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
