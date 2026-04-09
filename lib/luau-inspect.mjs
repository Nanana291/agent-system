#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau Inspect — Structured Script Analysis
// ──────────────────────────────────────────────

export function runLuauInspect(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { fileName: path.basename(filePath), error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');

  const features = extractFeatures(source, lines);
  const remotes = extractRemoteSummary(source, lines);
  const uiFramework = detectUIFramework(source);
  const uiStructure = extractUIStructure(source, lines, uiFramework);
  const loops = extractLoops(source, lines);
  const lifecycle = extractLifecycle(source, lines);
  const config = extractConfig(source);
  const hotspots = findHotspots(source, lines);

  return {
    fileName: path.basename(filePath),
    filePath: absPath,
    fileSize: fs.statSync(absPath).size,
    totalLines: lines.length,
    features,
    remotes,
    uiFramework,
    uiStructure,
    loops,
    lifecycle,
    config,
    hotspots,
  };
}

// ─── Feature Extraction ───

function extractFeatures(source, lines) {
  const features = [];
  const featurePatterns = [
    { regex: /BuildToggle\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'toggle' },
    { regex: /CreateToggle\s*\(\s*\{[^}]*Name\s*=\s*["']([^"']+)["']/gi, type: 'toggle' },
    { regex: /BuildDropdown\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'dropdown' },
    { regex: /BuildSlider\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'slider' },
    { regex: /BuildButton\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'button' },
    { regex: /BuildSection\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'section' },
    { regex: /CreateSection\s*\(\s*["']([^"']+)["']/gi, type: 'section' },
    { regex: /AddTab\s*\(\s*["']([^"']+)["']/gi, type: 'tab' },
  ];

  for (const pattern of featurePatterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match;
    while ((match = regex.exec(source)) !== null) {
      features.push({
        type: pattern.type,
        name: match[1],
        line: source.slice(0, match.index).split('\n').length,
      });
    }
  }

  // Deduplicate and group by section
  const sections = new Map();
  for (const f of features) {
    if (f.type === 'section' || f.type === 'tab') {
      sections.set(f.name, { type: f.type, controls: [] });
    }
  }

  // Assign controls to last seen section
  let currentSection = null;
  const ordered = [];
  for (const f of features) {
    if (f.type === 'section' || f.type === 'tab') {
      currentSection = f.name;
    }
    ordered.push({ ...f, section: currentSection || 'global' });
  }

  return {
    total: features.length,
    byType: countByType(features),
    ordered,
  };
}

function countByType(features) {
  const counts = {};
  for (const f of features) {
    counts[f.type] = (counts[f.type] || 0) + 1;
  }
  return counts;
}

// ─── Remote Summary ───

function extractRemoteSummary(source, lines) {
  const remoteSet = new Set();
  const callCount = { FireServer: 0, InvokeServer: 0, FireClient: 0, FireAllClients: 0, InvokeClient: 0 };
  const eventCount = { OnServerEvent: 0, OnClientEvent: 0, OnServerInvoke: 0, OnClientInvoke: 0 };

  const fireRegex = /([\w.]+)\s*:\s*(FireServer|InvokeServer|FireClient|FireAllClients|InvokeClient)\s*\(/g;
  let match;
  while ((match = fireRegex.exec(source)) !== null) {
    remoteSet.add(`${match[1]}:${match[2]}`);
    callCount[match[2]] = (callCount[match[2]] || 0) + 1;
  }

  const eventRegex = /([\w.]+)\s*\.\s*(OnServerEvent|OnClientEvent|OnServerInvoke|OnClientInvoke)\s*:/g;
  while ((match = eventRegex.exec(source)) !== null) {
    remoteSet.add(`${match[1]}:${match[2]}`);
    eventCount[match[2]] = (eventCount[match[2]] || 0) + 1;
  }

  return {
    uniqueRemotes: remoteSet.size,
    totalCalls: Object.values(callCount).reduce((a, b) => a + b, 0),
    totalEvents: Object.values(eventCount).reduce((a, b) => a + b, 0),
    callCount,
    eventCount,
    remotes: Array.from(remoteSet),
  };
}

// ─── UI Framework Detection ───

function detectUIFramework(source) {
  const frameworks = {
    LibSixtyTen: /LibSixtyTen|CreateWindow.*LibSixtyTen/.test(source),
    Obsidian: /loadstring.*game:HttpGet.*Obsidian|obsidian\.luau/.test(source),
    Orion: /OrionLib|loadstring.*Orion/.test(source),
    Fluent: /FluentLua|Fluent/.test(source),
    Custom: /CreateWindow|New.*Frame|New.*TextButton/.test(source) &&
      !/LibSixtyTen|Obsidian|Orion|Fluent/.test(source),
  };

  const detected = Object.entries(frameworks)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return {
    detected,
    primary: detected[0] || 'Unknown',
    loadMethod: detectLoadMethod(source),
  };
}

function detectLoadMethod(source) {
  if (source.includes('loadstring(') && source.includes('game:HttpGet(')) {
    const urlMatch = source.match(/game:HttpGet\s*\(\s*["']([^"']+)["']/);
    return { method: 'loadstring+HttpGet', url: urlMatch?.[1]?.slice(0, 80) || null };
  }
  if (source.includes('loadstring(') && source.includes('request(')) {
    return { method: 'loadstring+request' };
  }
  if (source.includes('require(')) {
    return { method: 'require' };
  }
  return { method: 'inline' };
}

// ─── UI Structure Extraction ───

function extractUIStructure(source, lines, uiFramework) {
  const tabs = [];
  const sections = [];

  // LibSixtyTen tabs
  const tabRegex = /AddTab\s*\(\s*["']([^"']+)["']\s*,/g;
  let match;
  while ((match = tabRegex.exec(source)) !== null) {
    tabs.push({
      name: match[1],
      line: source.slice(0, match.index).split('\n').length,
    });
  }

  // Sections
  const sectionRegex = /BuildSection\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/g;
  while ((match = sectionRegex.exec(source)) !== null) {
    sections.push({
      name: match[1],
      line: source.slice(0, match.index).split('\n').length,
      tab: findTabForLine(tabs, source.slice(0, match.index).split('\n').length),
    });
  }

  // Obsidian sections
  const obsSectionRegex = /CreateSection\s*\(\s*["']([^"']+)["']/g;
  while ((match = obsSectionRegex.exec(source)) !== null) {
    sections.push({
      name: match[1],
      line: source.slice(0, match.index).split('\n').length,
      tab: findTabForLine(tabs, source.slice(0, match.index).split('\n').length),
    });
  }

  return { tabs, sections };
}

function findTabForLine(tabs, lineNum) {
  let result = null;
  for (const tab of tabs) {
    if (tab.line <= lineNum) result = tab.name;
    else break;
  }
  return result;
}

// ─── Loop Extraction ───

function extractLoops(source, lines) {
  const loops = [];
  const loopRegex = /(?:taskSpawn|task\.spawn|coroutine\.wrap)\s*\(\s*function/g;
  let match;

  while ((match = loopRegex.exec(source)) !== null) {
    const startLine = source.slice(0, match.index).split('\n').length;
    const context = getContextAround(source, match.index, 200);
    const loopName = inferLoopName(context, lines, startLine - 1);
    const hasWait = /task\.wait/.test(context);
    const hasPcall = /pcall|pcallRef/.test(context);
    const whileMatch = context.match(/while\s+(true|\w+)\s+do/);

    loops.push({
      name: loopName,
      startLine,
      hasWait,
      hasPcall,
      hasWhile: !!whileMatch,
    });
  }

  // Also count bare while loops
  const whileRegex2 = /^\s*while\s+(true|\w+)\s+do/gm;
  while ((match = whileRegex2.exec(source)) !== null) {
    const lineNum = source.slice(0, match.index).split('\n').length;
    const already = loops.find(l => Math.abs(l.startLine - lineNum) < 3);
    if (!already) {
      loops.push({
        name: `while:${lineNum}`,
        startLine: lineNum,
        hasWait: /task\.wait/.test(getContextAround(source, match.index, 100)),
        hasPcall: false,
        hasWhile: true,
        isBare: true,
      });
    }
  }

  return loops;
}

function inferLoopName(context, lines, lineIdx) {
  // Look for nearby toggle/feature names
  const namePatterns = [
    /Title\s*=\s*["']([^"']+)["']/,
    /["'](\w+\s*(?:Block|Ultimate|Evasive|Farm|Skill|Counter|Auto))["']/i,
    /StartLoop\s*\(\s*["']([^"']+)["']/,
  ];

  // Scan 30 lines before
  for (let i = Math.max(0, lineIdx - 30); i < lineIdx; i++) {
    for (const pattern of namePatterns) {
      const m = lines[i].match(pattern);
      if (m) return m[1];
    }
  }

  return 'anonymous';
}

// ─── Lifecycle ───

function extractLifecycle(source, lines) {
  return {
    characterAdded: source.includes('CharacterAdded'),
    characterAddedConnect: /\.CharacterAdded\s*:\s*Connect/.test(source),
    humanoidRootPart: source.includes('HumanoidRootPart'),
    findFirstChild: source.includes(':FindFirstChild('),
    waitForChild: source.includes(':WaitForChild('),
    debounce: source.includes('debounce') || source.includes('cooldown'),
    startStopLoop: source.includes('StartLoop') && source.includes('StopLoop'),
    activeLoopVar: /activeLoop\s*\[/?.test(source) || /activeLoop\s*=/?.test(source),
  };
}

// ─── Config ───

function extractConfig(source) {
  return {
    themeManager: source.includes('ThemeManager'),
    saveManager: source.includes('SaveManager'),
    configFolder: extractConfigFolder(source),
    autoloadConfig: source.includes('AutoloadConfig') || source.includes('load_autoload'),
    hasSettingsTab: /["']Settings["']/.test(source),
  };
}

function extractConfigFolder(source) {
  const match = source.match(/["']([^"']*ImpHub[^"']*)["']/);
  return match?.[1] || null;
}

// ─── Hotspots ───

function findHotspots(source, lines) {
  const hotspots = [];

  // Very long functions
  const funcLines = countFunctionLines(source);
  for (const fn of funcLines) {
    if (fn.lines > 100) {
      hotspots.push({
        type: 'long-function',
        name: fn.name,
        line: fn.startLine,
        detail: `${fn.lines} lines`,
      });
    }
  }

  // Nested conditionals (depth > 4)
  let depth = 0;
  let maxDepth = 0;
  let maxDepthLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const opens = (lines[i].match(/\b(if|for|while|function)\b/g) || []).length;
    const closes = (lines[i].match(/^\s*end\b/g) || []).length;
    depth += opens - closes;
    if (depth > maxDepth) {
      maxDepth = depth;
      maxDepthLine = i + 1;
    }
  }
  if (maxDepth > 4) {
    hotspots.push({
      type: 'deep-nesting',
      line: maxDepthLine,
      detail: `depth ${maxDepth}`,
    });
  }

  // Global variable assignments
  const globals = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(?!local\s)\w+\s*=\s*/.test(lines[i]) && !lines[i].trim().startsWith('--')) {
      const varName = lines[i].match(/^\s*(\w+)\s*=/)?.[1];
      if (varName && varName[0] === varName[0].toUpperCase()) {
        globals.push({ name: varName, line: i + 1 });
      }
    }
  }
  if (globals.length > 0) {
    hotspots.push({
      type: 'global-assignments',
      count: globals.length,
      detail: globals.slice(0, 5).map(g => `${g.name}:${g.line}`).join(', '),
    });
  }

  return hotspots;
}

function countFunctionLines(source) {
  const functions = [];
  const regex = /(?:local\s+function\s+(\w+)|local\s+(\w+)\s*=\s*function)\s*\(?/g;
  let match;
  const lines = source.split('\n');

  while ((match = regex.exec(source)) !== null) {
    const name = match[1] || match[2] || '<anonymous>';
    const startLine = source.slice(0, match.index).split('\n').length;
    functions.push({ name, startLine, lines: 0 });
  }

  // Estimate function size by line distance to next function
  for (let i = 0; i < functions.length; i++) {
    const next = functions[i + 1];
    functions[i].lines = next ? next.startLine - functions[i].startLine : lines.length - functions[i].startLine;
  }

  return functions;
}

// ─── Helpers ───

function getContextAround(source, index, range) {
  const start = Math.max(0, index - range);
  const end = Math.min(source.length, index + range);
  return source.slice(start, end);
}

// ─── Renderer ───

export function renderLuauInspect(result) {
  if (result.error) {
    return `[LUAU INSPECT] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push(`[LUAU INSPECT] ${result.fileName}`);
  lines.push('═'.repeat(52));
  lines.push(`File size:       ${formatBytes(result.fileSize)}`);
  lines.push(`Total lines:     ${result.totalLines}`);
  lines.push('');

  // UI Framework
  lines.push('── UI Framework ─────────────────────────────────');
  lines.push(`  Primary:       ${result.uiFramework.primary}`);
  lines.push(`  Detected:      ${result.uiFramework.detected.join(', ') || 'none'}`);
  lines.push(`  Load method:   ${result.uiFramework.loadMethod.method}`);
  if (result.uiFramework.loadMethod.url) {
    lines.push(`  URL:           ${result.uiFramework.loadMethod.url}`);
  }
  lines.push('');

  // UI Structure
  if (result.uiStructure.tabs.length > 0) {
    lines.push('── Tabs ──────────────────────────────────────────');
    for (const tab of result.uiStructure.tabs) {
      lines.push(`  • ${tab.name} (line ${tab.line})`);
    }
    lines.push('');
  }

  if (result.uiStructure.sections.length > 0) {
    lines.push('── Sections ───────────────────────────────────────');
    for (const sec of result.uiStructure.sections) {
      const tabInfo = sec.tab ? ` [${sec.tab}]` : '';
      lines.push(`  • ${sec.name} (line ${sec.line})${tabInfo}`);
    }
    lines.push('');
  }

  // Features
  lines.push('── Features ─────────────────────────────────────');
  lines.push(`  Total:         ${result.features.total}`);
  for (const [type, count] of Object.entries(result.features.byType)) {
    lines.push(`  ${type}:        ${count}`);
  }
  lines.push('');

  // Remotes
  lines.push('── Remotes ──────────────────────────────────────');
  lines.push(`  Unique:        ${result.remotes.uniqueRemotes}`);
  lines.push(`  Fire calls:    ${result.remotes.totalCalls}`);
  lines.push(`  Event connects: ${result.remotes.totalEvents}`);
  const cc = result.remotes.callCount;
  if (cc.FireServer > 0) lines.push(`  FireServer:    ${cc.FireServer}`);
  if (cc.InvokeServer > 0) lines.push(`  InvokeServer:  ${cc.InvokeServer}`);
  if (cc.FireClient > 0) lines.push(`  FireClient:    ${cc.FireClient}`);
  lines.push('');

  // Loops
  if (result.loops.length > 0) {
    lines.push('── Loops ────────────────────────────────────────');
    for (const loop of result.loops) {
      const tags = [];
      if (loop.hasWait) tags.push('wait');
      if (loop.hasPcall) tags.push('pcall');
      if (loop.isBare) tags.push('bare');
      const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
      lines.push(`  • ${loop.name} (line ${loop.startLine})${tagStr}`);
    }
    lines.push('');
  }

  // Lifecycle
  const lc = result.lifecycle;
  lines.push('── Lifecycle ────────────────────────────────────');
  lines.push(`  CharacterAdded:     ${lc.characterAddedConnect ? '✅' : lc.characterAdded ? '⚠️' : '❌'}`);
  lines.push(`  HumanoidRootPart:   ${lc.humanoidRootPart ? '✅' : '❌'}`);
  lines.push(`  FindFirstChild:     ${lc.findFirstChild ? '✅' : '❌'}`);
  lines.push(`  Start/Stop loop:    ${lc.startStopLoop ? '✅' : '❌'}`);
  lines.push(`  Debounce:           ${lc.debounce ? '✅' : '❌'}`);
  lines.push('');

  // Config
  const cfg = result.config;
  if (cfg.themeManager || cfg.saveManager || cfg.configFolder) {
    lines.push('── Config ───────────────────────────────────────');
    lines.push(`  ThemeManager:     ${cfg.themeManager ? '✅' : '❌'}`);
    lines.push(`  SaveManager:      ${cfg.saveManager ? '✅' : '❌'}`);
    lines.push(`  Autoload:         ${cfg.autoloadConfig ? '✅' : '❌'}`);
    if (cfg.configFolder) lines.push(`  Config folder:    ${cfg.configFolder}`);
    lines.push('');
  }

  // Hotspots
  if (result.hotspots.length > 0) {
    lines.push('── Hotspots ─────────────────────────────────────');
    for (const h of result.hotspots) {
      lines.push(`  ⚡ ${h.type} (line ${h.line || '?'}) — ${h.detail}`);
    }
    lines.push('');
  }

  lines.push('═'.repeat(52));
  return lines.join('\n');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
