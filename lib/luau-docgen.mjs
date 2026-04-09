#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau DocGen — Auto-generate Script Documentation
// ──────────────────────────────────────────────

export function runLuauDocGen(filePath, options = {}) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');
  const fileName = path.basename(absPath);

  const doc = {
    fileName,
    filePath: absPath,
    totalLines: lines.length,
    fileSize: fs.statSync(absPath).size,
    generatedAt: new Date().toISOString(),
    metadata: extractMetadata(source, lines),
    features: extractFeatures(source),
    remotes: extractRemoteDirectory(source),
    functions: extractFunctionAPI(source, lines),
    uiStructure: extractUIDocumentation(source),
    lifecycle: extractLifecycleDocs(source),
    config: extractConfigDocs(source),
    stateVariables: extractStateVariables(source),
  };

  return doc;
}

// ─── Extractors ───

function extractMetadata(source, lines) {
  return {
    framework: detectFramework(source),
    executorCompat: detectExecutorCompat(source),
    hasConfig: source.includes('SetFolder') || source.includes('SaveManager') || source.includes('ThemeManager'),
    hasSettings: /Settings|Config/.test(source),
    loadMethod: detectLoadMethod(source),
    estimatedFeatures: countFeatures(source),
  };
}

function extractFeatures(source) {
  const features = [];
  const patterns = [
    { regex: /BuildToggle\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["'][^}]*Default\s*=\s*(true|false)/gi, type: 'Toggle' },
    { regex: /BuildToggle\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'Toggle' },
    { regex: /CreateToggle\s*\(\s*\{[^}]*Name\s*=\s*["']([^"']+)["'][^}]*Default\s*=\s*(true|false)/gi, type: 'Toggle' },
    { regex: /CreateToggle\s*\(\s*\{[^}]*Name\s*=\s*["']([^"']+)["']/gi, type: 'Toggle' },
    { regex: /BuildDropdown\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'Dropdown' },
    { regex: /BuildSlider\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["'][^}]*Default\s*=\s*(\d+)/gi, type: 'Slider' },
    { regex: /BuildSlider\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["'][^}]*Min\s*=\s*(\d+)[^}]*Max\s*=\s*(\d+)/gi, type: 'Slider' },
    { regex: /BuildButton\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'Button' },
    { regex: /BuildLabel\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'Label' },
    { regex: /BuildKeybind\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'Keybind' },
    { regex: /Textbox\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'Textbox' },
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
      if (match[2]) {
        if (p.type === 'Toggle') feature.default = match[2] === 'true';
        if (p.type === 'Slider') feature.default = parseInt(match[2]);
      }
      if (match[3] && p.type === 'Slider') feature.max = parseInt(match[3]);
      features.push(feature);
    }
  }

  return features;
}

function extractRemoteDirectory(source) {
  const remotes = [];
  const regex = /([\w.]+)\s*:\s*(FireServer|InvokeServer|FireClient|FireAllClients|InvokeClient)\s*\(/g;
  let match;
  const remoteSet = new Set();

  while ((match = regex.exec(source)) !== null) {
    const key = `${match[1]}:${match[2]}`;
    if (!remoteSet.has(key)) {
      remoteSet.add(key);
      const line = source.slice(0, match.index).split('\n').length;
      const context = getContextAround(source, match.index, 150);
      const pcallWrapped = /pcall|pcallRef|xpcall/.test(context.slice(0, 80));
      const args = extractArgs(source, match.index + match[0].length - 1);

      remotes.push({
        remote: match[1],
        method: match[2],
        line,
        pcallWrapped,
        args: args.slice(0, 200),
        direction: match[2] === 'FireServer' || match[2] === 'InvokeServer' ? 'Client → Server' : 'Server → Client',
      });
    }
  }

  // Event handlers
  const eventRegex = /([\w.]+)\s*\.\s*(OnServerEvent|OnClientEvent|OnServerInvoke|OnClientInvoke)\s*:\s*Connect\s*\(/g;
  while ((match = eventRegex.exec(source)) !== null) {
    remotes.push({
      remote: match[1],
      method: match[2] + ':Connect',
      line: source.slice(0, match.index).split('\n').length,
      direction: match[2].includes('Server') ? 'Server ← Client' : 'Client ← Server',
    });
  }

  return remotes;
}

function extractFunctionAPI(source, lines) {
  const functions = [];
  const regex = /(?:local\s+function\s+(\w+)|local\s+(\w+)\s*=\s*function)\s*\(([^)]*)\)/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const name = match[1] || match[2] || '<anonymous>';
    const params = match[3]?.split(',').map(p => p.trim()).filter(Boolean) || [];
    const startLine = source.slice(0, match.index).split('\n').length;
    const endLine = findFuncEnd(lines, startLine - 1);
    const body = lines.slice(startLine, endLine).join('\n');

    // Check what remotes it uses
    const remoteCalls = [];
    const remoteCallRegex = /([\w.]+)\s*:\s*(FireServer|InvokeServer)/g;
    let rm;
    while ((rm = remoteCallRegex.exec(body)) !== null) {
      remoteCalls.push(`${rm[1]}:${rm[2]}`);
    }

    // Check if it's a loop
    const isLoop = /taskSpawn|task\.spawn|while\s+/.test(body);

    // Check if it has pcall
    const hasPcall = /pcall|pcallRef|xpcall/.test(body);

    functions.push({
      name,
      params,
      line: startLine,
      lineCount: endLine - startLine + 1,
      remoteCalls: [...new Set(remoteCalls)],
      isLoop,
      hasPcall,
    });
  }

  return functions.sort((a, b) => b.lineCount - a.lineCount);
}

function extractUIDocumentation(source) {
  const tabs = [];
  const sections = [];
  let currentTab = null;

  const tabRegex = /AddTab\s*\(\s*["']([^"']+)["']/g;
  let match;
  while ((match = tabRegex.exec(source)) !== null) {
    currentTab = match[1];
    tabs.push({
      name: match[1],
      line: source.slice(0, match.index).split('\n').length,
    });
  }

  const sectionRegex = /BuildSection\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/g;
  while ((match = sectionRegex.exec(source)) !== null) {
    sections.push({
      name: match[1],
      tab: currentTab,
      line: source.slice(0, match.index).split('\n').length,
    });
  }

  // Obsidian sections
  const obsSectionRegex = /CreateSection\s*\(\s*["']([^"']+)["']/g;
  while ((match = obsSectionRegex.exec(source)) !== null) {
    sections.push({
      name: match[1],
      tab: currentTab,
      line: source.slice(0, match.index).split('\n').length,
    });
  }

  return { tabs, sections };
}

function extractLifecycleDocs(source) {
  return {
    characterRebind: {
      present: /\.CharacterAdded\s*:\s*Connect/.test(source),
      detail: /\.CharacterAdded\s*:\s*Connect\s*\(\s*function/.test(source) ? 'CharacterAdded:Connect(function)' : null,
    },
    respawnGuard: {
      present: /CharacterAdded/.test(source) && /HumanoidRootPart/.test(source),
      detail: /HumanoidRootPart/.test(source) ? 'Validates HumanoidRootPart after respawn' : null,
    },
    threadManagement: {
      hasStartStop: source.includes('StartLoop') && source.includes('StopLoop'),
      hasActiveLoopVar: /activeLoop\s*\[?\s*\w*\s*\]?\s*=/.test(source),
    },
    debounce: {
      present: /debounce|cooldown/.test(source),
      pattern: /local\s+debounce\s*=\s*false/.test(source) ? 'boolean debounce' : /cooldown/.test(source) ? 'cooldown timer' : null,
    },
  };
}

function extractConfigDocs(source) {
  return {
    saveManager: {
      present: source.includes('SaveManager'),
      folder: extractConfigFolder(source),
      autoload: source.includes('LoadAutoload') || source.includes('load_autoload'),
    },
    themeManager: {
      present: source.includes('ThemeManager'),
    },
  };
}

function extractStateVariables(source) {
  const states = [];
  // Pattern: local state = {} or local State = {}
  const stateRegex = /local\s+(\w*State\w*|Toggles|Options|Config|Settings)\s*=\s*\{/gi;
  let match;
  while ((match = stateRegex.exec(source)) !== null) {
    const name = match[1];
    const line = source.slice(0, match.index).split('\n').length;
    // Extract keys from the table
    const context = getContextAround(source, match.index, 500);
    const keys = [];
    const keyRegex = /\[\s*["']([^"']+)["']\s*\]\s*=/g;
    let km;
    while ((km = keyRegex.exec(context)) !== null) {
      keys.push(km[1]);
    }
    states.push({ name, line, keys });
  }
  return states;
}

// ─── Helpers ───

function detectFramework(source) {
  if (/LibSixtyTen|createLibSixtyTen/.test(source)) return 'LibSixtyTen';
  if (/Obsidian|obsidian\.luau/.test(source)) return 'Obsidian';
  if (/Orion/.test(source)) return 'Orion';
  if (/Fluent/.test(source)) return 'Fluent';
  if (/RayField/.test(source)) return 'RayField';
  return 'Unknown';
}

function detectExecutorCompat(source) {
  const execs = [];
  if (/getgenv|setclipboard|writefile/.test(source)) execs.push('Standard');
  if (/request\(|httpRequest/.test(source)) execs.push('HTTP API');
  if (/isexecutorclosure|identifyexecutor/.test(source)) execs.push('Detection');
  return execs.length > 0 ? execs : ['None detected'];
}

function detectLoadMethod(source) {
  if (source.includes('loadstring(') && source.includes('game:HttpGet(')) {
    return 'loadstring + HttpGet';
  }
  if (source.includes('require(')) return 'require';
  if (source.includes('loadstring(')) return 'loadstring';
  return 'Inline (no external load)';
}

function countFeatures(source) {
  return (source.match(/BuildToggle|CreateToggle|BuildDropdown|BuildSlider|BuildButton|Toggle\s*\(\s*\{/g) || []).length;
}

function getContextAround(source, index, range) {
  return source.slice(Math.max(0, index - range), Math.min(source.length, index + range));
}

function extractArgs(source, openParenIdx) {
  let depth = 0;
  let start = -1;
  for (let i = openParenIdx; i < Math.min(source.length, openParenIdx + 300); i++) {
    if (source[i] === '(') { if (depth === 0) start = i + 1; depth++; }
    else if (source[i] === ')') { depth--; if (depth === 0) return source.slice(start, i).trim(); }
  }
  return '';
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

function extractConfigFolder(source) {
  const match = source.match(/SetFolder\s*\(\s*["']([^"']+)["']/);
  return match?.[1] || null;
}

// ─── Markdown Renderer ───

export function renderDocGenMarkdown(doc) {
  const lines = [];

  lines.push(`# ${doc.fileName}`);
  lines.push('');
  lines.push(`> Auto-generated by agent-system luau-docgen`);
  lines.push(`> Generated: ${doc.generatedAt}`);
  lines.push('');

  // Overview
  lines.push('## Overview');
  lines.push('');
  lines.push(`| Property | Value |`);
  lines.push(`|----------|-------|`);
  lines.push(`| Lines | ${doc.totalLines} |`);
  lines.push(`| Size | ${formatBytes(doc.fileSize)} |`);
  lines.push(`| UI Framework | ${doc.metadata.framework} |`);
  lines.push(`| Load Method | ${doc.metadata.loadMethod} |`);
  lines.push(`| Estimated Features | ${doc.metadata.estimatedFeatures} |`);
  lines.push(`| Has Config | ${doc.metadata.hasConfig ? 'Yes' : 'No'} |`);
  lines.push('');

  // Features
  if (doc.features.length > 0) {
    lines.push('## Features');
    lines.push('');
    lines.push(`Total: ${doc.features.length}`);
    lines.push('');
    lines.push('| # | Type | Name | Default | Line |');
    lines.push('|---|------|------|---------|------|');
    for (let i = 0; i < doc.features.length; i++) {
      const f = doc.features[i];
      const def = f.default !== undefined ? `${f.default}` : '—';
      lines.push(`| ${i + 1} | ${f.type} | ${f.name} | ${def} | ${f.line} |`);
    }
    lines.push('');
  }

  // UI Structure
  if (doc.uiStructure.tabs.length > 0 || doc.uiStructure.sections.length > 0) {
    lines.push('## UI Structure');
    lines.push('');
    for (const tab of doc.uiStructure.tabs) {
      lines.push(`### 📑 ${tab.name}`);
      const tabSections = doc.uiStructure.sections.filter(s => s.tab === tab.name);
      for (const sec of tabSections) {
        lines.push(`- 📂 ${sec.name}`);
      }
      lines.push('');
    }
  }

  // Remote Directory
  if (doc.remotes.length > 0) {
    lines.push('## Remote Directory');
    lines.push('');
    lines.push('| # | Remote | Method | Direction | Pcall | Line |');
    lines.push('|---|--------|--------|-----------|-------|------|');
    for (let i = 0; i < doc.remotes.length; i++) {
      const r = doc.remotes[i];
      const pcall = r.pcallWrapped !== undefined ? (r.pcallWrapped ? '✅' : '❌') : '—';
      lines.push(`| ${i + 1} | ${r.remote} | ${r.method} | ${r.direction || '—'} | ${pcall} | ${r.line || '—'} |`);
    }
    lines.push('');
  }

  // Function API
  if (doc.functions.length > 0) {
    lines.push('## Function API');
    lines.push('');
    lines.push('| # | Function | Params | Lines | Loop | Pcall | Remotes |');
    lines.push('|---|----------|--------|-------|------|-------|---------|');
    for (let i = 0; i < doc.functions.length; i++) {
      const f = doc.functions[i];
      const params = f.params.length > 0 ? f.params.join(', ') : 'none';
      const loop = f.isLoop ? '🔄' : '—';
      const pcall = f.hasPcall ? '✅' : '—';
      const remotes = f.remoteCalls.length > 0 ? f.remoteCalls.join(', ') : '—';
      lines.push(`| ${i + 1} | ${f.name} | ${params} | ${f.lineCount} | ${loop} | ${pcall} | ${remotes} |`);
    }
    lines.push('');
  }

  // Lifecycle
  lines.push('## Lifecycle');
  lines.push('');
  const lc = doc.lifecycle;
  lines.push(`| Pattern | Status | Detail |`);
  lines.push(`|---------|--------|--------|`);
  lines.push(`| Character Rebind | ${lc.characterRebind.present ? '✅' : '❌'} | ${lc.characterRebind.detail || '—'} |`);
  lines.push(`| Respawn Guard | ${lc.respawnGuard.present ? '✅' : '❌'} | ${lc.respawnGuard.detail || '—'} |`);
  lines.push(`| Start/Stop Loop | ${lc.threadManagement.hasStartStop ? '✅' : '❌'} | ${lc.threadManagement.hasActiveLoopVar ? 'activeLoop var' : '—'} |`);
  lines.push(`| Debounce | ${lc.debounce.present ? '✅' : '❌'} | ${lc.debounce.pattern || '—'} |`);
  lines.push('');

  // Config
  if (doc.config.saveManager.present || doc.config.themeManager.present) {
    lines.push('## Configuration');
    lines.push('');
    lines.push(`| System | Status | Detail |`);
    lines.push(`|--------|--------|--------|`);
    lines.push(`| SaveManager | ${doc.config.saveManager.present ? '✅' : '❌'} | ${doc.config.saveManager.folder || '—'} |`);
    lines.push(`| Autoload | ${doc.config.saveManager.autoload ? '✅' : '❌'} | — |`);
    lines.push(`| ThemeManager | ${doc.config.themeManager.present ? '✅' : '❌'} | — |`);
    lines.push('');
  }

  // State Variables
  if (doc.stateVariables.length > 0) {
    lines.push('## State Variables');
    lines.push('');
    for (const sv of doc.stateVariables) {
      lines.push(`### ${sv.name} (L${sv.line})`);
      if (sv.keys.length > 0) {
        lines.push(`Keys: ${sv.keys.join(', ')}`);
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
