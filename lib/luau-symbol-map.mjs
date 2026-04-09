#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau Symbol Map — Comprehensive Symbol Index
// ──────────────────────────────────────────────
// Extracts every function, variable, remote, table,
// event, and loop with full metadata. Output as
// compact JSON for context-efficient querying.

export function runLuauSymbolMap(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');
  const fileName = path.basename(absPath);

  // Build the full symbol table
  const symbols = {
    meta: extractMeta(absPath, source, lines),
    functions: extractFunctions(source, lines),
    variables: extractVariables(source, lines),
    remotes: extractRemotes(source, lines),
    tables: extractTables(source, lines),
    events: extractEvents(source, lines),
    loops: extractLoops(source, lines),
    constants: extractConstants(source, lines),
  };

  // Build cross-references
  const xrefs = buildCrossReferences(symbols, source, lines);

  // Compute summary stats
  const stats = computeStats(symbols);

  return {
    fileName,
    filePath: absPath,
    generatedAt: new Date().toISOString(),
    symbols,
    xrefs,
    stats,
  };
}

// ─── Meta Extraction ───

function extractMeta(absPath, source, lines) {
  return {
    lines: lines.length,
    size: fs.statSync(absPath).size,
    framework: detectFramework(source),
    hasConfig: /SetFolder|SaveManager|ThemeManager/.test(source),
    featureCount: (source.match(/BuildToggle|CreateToggle|BuildDropdown|BuildSlider|BuildButton/g) || []).length,
  };
}

function detectFramework(source) {
  if (/LibSixtyTen|createLibSixtyTen/.test(source)) return 'LibSixtyTen';
  if (/Obsidian|obsidian\.luau/.test(source)) return 'Obsidian';
  if (/Orion/.test(source)) return 'Orion';
  if (/Fluent/.test(source)) return 'Fluent';
  if (/RayField/.test(source)) return 'RayField';
  return 'Unknown';
}

// ─── Function Extraction ───
// For each function: name, params, line range, body length,
// type inference from return statements, called-by analysis,
// remote usage, nested function count, complexity score.

function extractFunctions(source, lines) {
  const functions = [];
  const patterns = [
    // local function name(params)
    { regex: /local\s+function\s+(\w+)\s*\(([^)]*)\)/g, type: 'named' },
    // local name = function(params)
    { regex: /local\s+(\w+)\s*=\s*function\s*\(([^)]*)\)/g, type: 'named' },
    // function Module:name(params)
    { regex: /function\s+(\w+(?:\.\w+)?(?::\w+)?)\s*\(([^)]*)\)/g, type: 'method' },
    // taskSpawn(function() — anonymous loop
    { regex: /taskSpawn\s*\(\s*function\s*\(\s*\)/g, type: 'loop-anon' },
    // task.spawn(function()
    { regex: /task\.spawn\s*\(\s*function\s*\(\s*\)/g, type: 'loop-anon' },
  ];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match;
    while ((match = regex.exec(source)) !== null) {
      const startLine = source.slice(0, match.index).split('\n').length;

      let name;
      if (pattern.type === 'loop-anon') {
        name = inferLoopName(lines, startLine - 1, source, match.index);
      } else {
        name = match[1] || '<anonymous>';
      }

      const params = match[2]
        ? match[2].split(',').map(p => p.trim()).filter(Boolean)
        : [];

      const endLine = findFuncEnd(lines, startLine - 1);
      const bodyLines = lines.slice(startLine, endLine);
      const bodySource = bodyLines.join('\n');

      // Type inference from return
      const returnMatch = bodySource.match(/return\s+([^\n]+)/);
      const returnType = returnMatch ? inferType(returnMatch[1]) : 'void';

      // Remote calls used
      const remoteCalls = [];
      const remoteRegex = /([\w.]+)\s*:\s*(FireServer|InvokeServer|FireClient|FireAllClients|InvokeClient)\s*\(/g;
      let rm;
      while ((rm = remoteRegex.exec(bodySource)) !== null) {
        remoteCalls.push(`${rm[1]}:${rm[2]}`);
      }

      // Nested functions
      const nestedCount = (bodySource.match(/\bfunction\b/g) || []).length - 1;

      // Complexity
      const complexity = computeComplexity(bodySource);

      // pcall usage
      const hasPcall = /pcall|pcallRef|xpcall/.test(bodySource);

      // Debounce/guard patterns
      const hasDebounce = /debounce|cooldown/.test(bodySource);
      const hasGuard = /if\s+not\s+|if\s+not\s*\(|if\s+\w+\s*==\s*nil|if\s+\w+\s*==\s*false/.test(bodySource);

      functions.push({
        name,
        type: pattern.type,
        params,
        line: startLine,
        endLine,
        lineCount: endLine - startLine + 1,
        returnType,
        remoteCalls: [...new Set(remoteCalls)],
        nestedFunctions: nestedCount,
        complexity,
        hasPcall,
        hasDebounce,
        hasGuard,
      });
    }
  }

  return functions.sort((a, b) => a.line - b.line);
}

function inferLoopName(lines, startIdx, source, matchIdx) {
  // Scan backwards up to 40 lines for toggle/feature names
  for (let i = startIdx; i >= Math.max(0, startIdx - 40); i--) {
    const line = lines[i];
    // Title = "..."
    const titleMatch = line.match(/Title\s*=\s*["']([^"']+)["']/);
    if (titleMatch) return `Loop:${titleMatch[1]}`;

    // Name = "..."
    const nameMatch = line.match(/Name\s*=\s*["']([^"']+)["']/);
    if (nameMatch) return `Loop:${nameMatch[1]}`;

    // StartLoop("...")
    const startLoopMatch = line.match(/StartLoop\s*\(\s*["']([^"']+)["']/);
    if (startLoopMatch) return `Loop:${startLoopMatch[1]}`;

    // local xxxToggle = BuildToggle
    const toggleMatch = line.match(/local\s+(\w*Toggle\w*)\s*=/);
    if (toggleMatch) return `Loop:${toggleMatch[1]}`;
  }

  return `Loop:${startIdx + 1}`;
}

function inferType(expr) {
  expr = expr.trim();
  if (expr === 'true' || expr === 'false') return 'boolean';
  if (/^-?\d+(\.\d+)?$/.test(expr)) return 'number';
  if (expr.startsWith('"') || expr.startsWith("'")) return 'string';
  if (expr.startsWith('{')) return 'table';
  if (expr.startsWith('function')) return 'function';
  if (expr === 'nil') return 'nil';
  if (/\w+\.\w+/.test(expr)) return 'Instance';
  return 'unknown';
}

function computeComplexity(source) {
  let c = 1;
  const branchPatterns = [/\bif\b/g, /\belseif\b/g, /\band\b/g, /\bor\b/g, /\bfor\b/g, /\bwhile\b/g, /\brepeat\b/g];
  for (const p of branchPatterns) {
    const matches = source.match(p) || [];
    c += matches.length;
  }
  return c;
}

function findFuncEnd(lines, startIdx) {
  let depth = 0;
  let started = false;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*--/.test(line)) continue;
    const opens = (line.match(/\b(if|then|else|elseif|for|while|do|function|repeat)\b/g) || []).length;
    const closes = (line.match(/^\s*end\b/g) || []).length;
    if (/^(local\s+)?function\s/.test(line) || /^\bfor\b/.test(line) || /^\bwhile\b/.test(line)) depth++;
    if (/\bthen\b/.test(line) && !/\belseif\b/.test(line) && !/\bif\b/.test(line.trim().split('then')[0])) {
      // 'then' on same line as if/elseif
    }
    // Count 'then' as opening
    if (/\bthen\b/.test(line)) { /* handled by if/elseif count */ }
    depth -= closes;
    if (depth <= 0 && started) return i;
    if (opens > 0 || closes > 0) started = true;
  }
  return lines.length - 1;
}

// ─── Variable Extraction ───
// For each local: name, type inference, scope (file/function),
// read count, write count, definition line, last-use line.

function extractVariables(source, lines) {
  const variables = [];

  // Top-level locals: local name = value
  const localRegex = /^\s*local\s+(\w+)\s*(?:=\s*(.+))?$/gm;
  let match;
  while ((match = localRegex.exec(source)) !== null) {
    const name = match[1];
    const value = match[2] || '';
    const line = source.slice(0, match.index).split('\n').length;

    if (name.startsWith('_')) continue; // Conventionally unused
    if (/^function\s/.test(value)) continue; // Handled as function
    if (/^taskSpawn|task\.spawn/.test(value)) continue; // Handled as loop

    // Count reads and writes
    const readCount = countVariableReads(source, name, line);
    const writeCount = countVariableWrites(source, name, line);

    // Type inference
    const type = value ? inferType(value) : 'unknown';

    // Scope analysis
    const scope = analyzeScope(lines, line - 1);

    // Is it a service?
    const isService = /game\s*:\s*GetService/.test(value);

    variables.push({
      name,
      type,
      scope,
      line,
      reads: readCount,
      writes: writeCount,
      isService,
      isConstant: /^[A-Z_]+$/.test(name) && writeCount === 0,
    });
  }

  return variables;
}

function countVariableReads(source, name, defLine) {
  const regex = new RegExp(`\\b${name}\\b`, 'g');
  let count = 0;
  let match;
  let lineNum = 1;
  let idx = 0;
  while ((match = regex.exec(source)) !== null) {
    const line = source.slice(0, match.index).split('\n').length;
    if (line > defLine) {
      // Not a write (not on LHS of =)
      const context = source.slice(match.index, match.index + name.length + 2);
      if (!/^\s*=\s*/.test(context.slice(name.length))) {
        count++;
      }
    }
  }
  return count;
}

function countVariableWrites(source, name, defLine) {
  const regex = new RegExp(`\\b${name}\\s*=`, 'g');
  let count = 0;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const line = source.slice(0, match.index).split('\n').length;
    if (line > defLine) count++;
  }
  return count;
}

function analyzeScope(lines, defIdx) {
  // Check if variable is defined inside a function block
  let depth = 0;
  for (let i = 0; i < defIdx; i++) {
    const line = lines[i];
    if (/^\s*--/.test(line)) continue;
    depth += (line.match(/\bfunction\b/g) || []).length;
    depth -= (line.match(/^\s*end\b/g) || []).length;
  }
  return depth > 0 ? 'function-local' : 'file';
}

// ─── Remote Extraction ───
// For each remote: variable name, remote path, all call sites,
// pcall-wrapped sites, event connections, direction.

function extractRemotes(source, lines) {
  const remotes = [];
  const remoteDefs = new Map();

  // Find remote definitions: local xxx = parent:WaitForChild("RemoteName")
  const defRegex = /local\s+(\w+)\s*=\s*([\w.]+)\s*:\s*(WaitForChild|FindFirstChild|findFirstChild)\s*\(\s*["']([^"']+)["']\s*\)/g;
  let match;
  while ((match = defRegex.exec(source)) !== null) {
    remoteDefs.set(match[1], {
      varName: match[1],
      parentPath: match[2],
      remoteName: match[4],
      line: source.slice(0, match.index).split('\n').length,
    });
  }

  // Find all remote calls
  for (const [varName, def] of remoteDefs) {
    const callRegex = new RegExp(`\\b${varName}\\s*:\\s*(FireServer|InvokeServer|FireClient|FireAllClients|InvokeClient)\\s*\\(`, 'g');
    const calls = [];
    let cm;
    while ((cm = callRegex.exec(source)) !== null) {
      const line = source.slice(0, cm.index).split('\n').length;
      const context = source.slice(Math.max(0, cm.index - 80), cm.index + cm[0].length + 100);
      const pcallWrapped = /pcall|pcallRef|xpcall/.test(context.slice(0, 100));
      calls.push({ line, method: cm[1], pcallWrapped });
    }

    // Event connections
    const eventRegex = new RegExp(`\\b${varName}\\s*\\.\\s*(OnServerEvent|OnClientEvent|OnServerInvoke|OnClientInvoke)\\s*:\\s*Connect`, 'g');
    const events = [];
    let em;
    while ((em = eventRegex.exec(source)) !== null) {
      events.push({
        eventType: em[1],
        line: source.slice(0, em.index).split('\n').length,
      });
    }

    remotes.push({
      varName: def.varName,
      remoteName: def.remoteName,
      parentPath: def.parentPath,
      line: def.line,
      calls,
      events,
      totalCalls: calls.length,
      totalEvents: events.length,
      unprotectedCalls: calls.filter(c => !c.pcallWrapped).length,
    });
  }

  return remotes;
}

// ─── Table Extraction ───
// For each table: name, keys (string/number), nested depth,
// usage sites, is-state (Toggles, Options, Config, Settings).

function extractTables(source, lines) {
  const tables = [];

  // Named table definitions: local name = { ... }
  const tableRegex = /local\s+(\w+)\s*=\s*\{/g;
  let match;
  while ((match = tableRegex.exec(source)) !== null) {
    const name = match[1];
    const line = source.slice(0, match.index).split('\n').length;

    // Extract keys from the next 30 lines
    const contextEnd = source.indexOf('\n', match.index + 500);
    const context = source.slice(match.index, contextEnd > 0 ? contextEnd : source.length);
    const keys = [];
    const keyRegex = /\[\s*["']([^"']+)["']\s*\]\s*=|(\w+)\s*=\s*(?!function)/g;
    let km;
    const seenKeys = new Set();
    while ((km = keyRegex.exec(context)) !== null) {
      const key = km[1] || km[2];
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        keys.push(key);
      }
    }

    // Is it a state table?
    const isState = /^(Toggles|Options|Config|Settings|State|Defaults|Presets|FarmProfile|GameConfig)$/.test(name);

    // Usage sites
    const usageRegex = new RegExp(`\\b${name}\\b`, 'g');
    let usageCount = 0;
    let um;
    while ((um = usageRegex.exec(source)) !== null) usageCount++;

    tables.push({
      name,
      line,
      keys: keys.slice(0, 30), // Cap for readability
      keyCount: keys.length,
      isState,
      usageCount: usageCount - 1, // Minus definition
    });
  }

  return tables.filter(t => t.keys.length > 0 || t.isState);
}

// ─── Event Extraction ───
// All Connect patterns: Changed, Click, CharacterAdded, etc.

function extractEvents(source, lines) {
  const events = [];
  const patterns = [
    { regex: /([\w.]+)\.Changed\s*:\s*Connect\s*\(/g, type: 'Changed' },
    { regex: /([\w.]+)\.MouseButton1Click\s*:\s*Connect\s*\(/g, type: 'Click' },
    { regex: /([\w.]+)\.MouseButton2Click\s*:\s*Connect\s*\(/g, type: 'RightClick' },
    { regex: /([\w.]+)\.CharacterAdded\s*:\s*Connect\s*\(/g, type: 'CharacterAdded' },
    { regex: /([\w.]+)\.ChildAdded\s*:\s*Connect\s*\(/g, type: 'ChildAdded' },
    { regex: /([\w.]+)\.ChildRemoved\s*:\s*Connect\s*\(/g, type: 'ChildRemoved' },
    { regex: /([\w.]+)\.GetPropertyChangedSignal\s*\(\s*["']([^"']+)["']\s*\)\s*:\s*Connect/g, type: 'PropertyChanged' },
    { regex: /([\w.]+)\.(OnServerEvent|OnClientEvent|OnServerInvoke|OnClientInvoke)\s*:\s*Connect\s*\(/g, type: 'RemoteEvent' },
  ];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match;
    while ((match = regex.exec(source)) !== null) {
      const line = source.slice(0, match.index).split('\n').length;
      const target = match[1] || match[2] || '';
      const extra = match[2] && pattern.type === 'PropertyChanged' ? match[2] : null;
      events.push({
        type: pattern.type,
        target,
        extra,
        line,
        name: extra ? `${target}.${extra}` : target,
      });
    }
  }

  return events.sort((a, b) => a.line - b.line);
}

// ─── Loop Extraction ───

function extractLoops(source, lines) {
  const loops = [];

  // taskSpawn loops
  const taskSpawnRegex = /taskSpawn\s*\(\s*function/g;
  let match;
  while ((match = taskSpawnRegex.exec(source)) !== null) {
    const startLine = source.slice(0, match.index).split('\n').length;
    const endLine = findFuncEnd(lines, startLine - 1);
    const context = source.slice(match.index, Math.min(source.length, match.index + 500));
    const name = inferLoopName(lines, startLine - 1, source, match.index);
    const hasWait = /task\.wait/.test(context);
    const hasPcall = /pcall|pcallRef/.test(context);
    const whileMatch = context.match(/while\s+(true|\w+)\s+do/);
    const interval = whileMatch && context.match(/task\.wait\(\s*([\d.]+)\s*\)/)
      ? parseFloat(context.match(/task\.wait\(\s*([\d.]+)\s*\)/)[1])
      : null;

    loops.push({
      name,
      type: 'taskSpawn',
      line: startLine,
      endLine,
      lineCount: endLine - startLine + 1,
      hasWait,
      hasPcall,
      hasWhile: !!whileMatch,
      interval,
    });
  }

  return loops;
}

// ─── Constant Extraction ───

function extractConstants(source, lines) {
  const constants = [];
  const regex = /^\s*local\s+([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/gm;
  let match;
  while ((match = regex.exec(source)) !== null) {
    constants.push({
      name: match[1],
      value: match[2].trim().slice(0, 100),
      line: source.slice(0, match.index).split('\n').length,
      type: inferType(match[2]),
    });
  }
  return constants;
}

// ─── Cross-References ───

function buildCrossReferences(symbols, source, lines) {
  // For each function, what does it call?
  const funcCalls = {};
  for (const func of symbols.functions) {
    const body = lines.slice(func.line - 1, func.endLine).join('\n');
    const calls = [];

    for (const other of symbols.functions) {
      if (other.name === func.name) continue;
      if (new RegExp(`\\b${other.name}\\s*\\(`).test(body)) {
        calls.push(other.name);
      }
    }

    funcCalls[func.name] = calls;
  }

  // For each variable, what functions use it?
  const varUsage = {};
  for (const v of symbols.variables) {
    const users = [];
    for (const func of symbols.functions) {
      const body = lines.slice(func.line - 1, func.endLine).join('\n');
      if (new RegExp(`\\b${v.name}\\b`).test(body)) {
        users.push(func.name);
      }
    }
    varUsage[v.name] = users;
  }

  // For each remote, what functions call it?
  const remoteCallers = {};
  for (const r of symbols.remotes) {
    const callers = new Set();
    for (const call of r.calls) {
      for (const func of symbols.functions) {
        if (call.line >= func.line && call.line <= func.endLine) {
          callers.add(func.name);
        }
      }
    }
    remoteCallers[r.varName] = [...callers];
  }

  return {
    funcCalls,
    varUsage,
    remoteCallers,
  };
}

// ─── Stats ───

function computeStats(symbols) {
  const funcs = symbols.functions;
  const totalFuncLines = funcs.reduce((sum, f) => sum + f.lineCount, 0);
  const avgComplexity = funcs.length > 0 ? Math.round(funcs.reduce((s, f) => s + f.complexity, 0) / funcs.length) : 0;
  const maxComplexity = funcs.length > 0 ? Math.max(...funcs.map(f => f.complexity)) : 0;
  const mostComplex = funcs.find(f => f.complexity === maxComplexity)?.name || 'none';

  const totalRemoteCalls = symbols.remotes.reduce((s, r) => s + r.totalCalls, 0);
  const totalUnprotected = symbols.remotes.reduce((s, r) => s + r.unprotectedCalls, 0);

  const stateTables = symbols.tables.filter(t => t.isState);
  const events = symbols.events;

  return {
    totalFunctions: funcs.length,
    totalVariables: symbols.variables.length,
    totalRemotes: symbols.remotes.length,
    totalRemoteCalls,
    totalUnprotected,
    totalTables: symbols.tables.length,
    stateTables: stateTables.length,
    totalEvents: events.length,
    totalLoops: symbols.loops.length,
    totalConstants: symbols.constants.length,
    avgComplexity,
    maxComplexity,
    mostComplexFunction: mostComplex,
  };
}

// ─── JSON Renderer (compact) ───

export function renderSymbolMapJSON(result) {
  return JSON.stringify(result, null, 2);
}

// ─── Markdown Renderer (human-readable) ───

export function renderSymbolMapMarkdown(result) {
  const s = result.symbols;
  const st = result.stats;
  const x = result.xrefs;

  const lines = [];

  lines.push(`# Symbol Map — ${result.fileName}`);
  lines.push('');
  lines.push(`> ${s.meta.lines} lines | ${s.meta.size} bytes | ${s.meta.framework} | ${s.meta.featureCount} features`);
  lines.push(`> Generated: ${result.generatedAt}`);
  lines.push('');

  // Stats
  lines.push('## Stats');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Functions | ${st.totalFunctions} |`);
  lines.push(`| Variables | ${st.totalVariables} |`);
  lines.push(`| Remotes | ${st.totalRemotes} (${st.totalRemoteCalls} calls) |`);
  lines.push(`| Unprotected calls | ${st.totalUnprotected} |`);
  lines.push(`| Tables (${st.stateTables} state) | ${st.totalTables} |`);
  lines.push(`| Events | ${st.totalEvents} |`);
  lines.push(`| Loops | ${st.totalLoops} |`);
  lines.push(`| Avg complexity | ${st.avgComplexity} |`);
  lines.push(`| Max complexity | ${st.maxComplexity} (${st.mostComplexFunction}) |`);
  lines.push('');

  // Functions
  if (s.functions.length > 0) {
    lines.push(`## Functions (${s.functions.length})`);
    lines.push('');
    lines.push('| # | Name | Params | Lines | Complexity | Remotes | Pcall |');
    lines.push('|---|------|--------|-------|------------|---------|-------|');
    for (let i = 0; i < s.functions.length; i++) {
      const f = s.functions[i];
      const params = f.params.length > 0 ? f.params.join(', ') : '—';
      const remotes = f.remoteCalls.length > 0 ? f.remoteCalls.join(', ') : '—';
      const pcall = f.hasPcall ? '✅' : '—';
      const complexityIcon = f.complexity <= 5 ? '🟢' : f.complexity <= 10 ? '🟡' : f.complexity <= 20 ? '🟠' : '🔴';
      lines.push(`| ${i + 1} | ${f.name} | ${params} | ${f.lineCount} | ${complexityIcon} ${f.complexity} | ${remotes} | ${pcall} |`);
    }
    lines.push('');

    // Call graph
    lines.push('### Call Graph');
    lines.push('');
    for (const [func, calls] of Object.entries(x.funcCalls)) {
      if (calls.length > 0) {
        lines.push(`- ${func} → ${calls.join(', ')}`);
      }
    }
    lines.push('');
  }

  // Variables
  if (s.variables.length > 0) {
    lines.push(`## Variables (${s.variables.length})`);
    lines.push('');
    lines.push('| # | Name | Type | Scope | Reads | Writes | Service |');
    lines.push('|---|------|------|-------|-------|--------|---------|');
    for (let i = 0; i < s.variables.length; i++) {
      const v = s.variables[i];
      lines.push(`| ${i + 1} | ${v.name} | ${v.type} | ${v.scope} | ${v.reads} | ${v.writes} | ${v.isService ? '✅' : '—'} |`);
    }
    lines.push('');

    // Variable usage by function
    lines.push('### Variable Usage');
    lines.push('');
    for (const [name, users] of Object.entries(x.varUsage)) {
      if (users.length > 0) {
        lines.push(`- ${name} used in: ${users.join(', ')}`);
      }
    }
    lines.push('');
  }

  // Remotes
  if (s.remotes.length > 0) {
    lines.push(`## Remotes (${s.remotes.length})`);
    lines.push('');
    lines.push('| # | Variable | Name | Calls | Events | Unprotected |');
    lines.push('|---|----------|------|-------|--------|-------------|');
    for (let i = 0; i < s.remotes.length; i++) {
      const r = s.remotes[i];
      lines.push(`| ${i + 1} | ${r.varName} | ${r.remoteName} | ${r.totalCalls} | ${r.totalEvents} | ${r.unprotectedCalls > 0 ? '❌ ' + r.unprotectedCalls : '✅'} |`);
    }
    lines.push('');

    // Remote callers
    lines.push('### Remote Callers');
    lines.push('');
    for (const [varName, callers] of Object.entries(x.remoteCallers)) {
      if (callers.length > 0) {
        lines.push(`- ${varName} called by: ${callers.join(', ')}`);
      }
    }
    lines.push('');
  }

  // Tables
  if (s.tables.length > 0) {
    lines.push(`## Tables (${s.tables.length})`);
    lines.push('');
    lines.push('| # | Name | Keys | Usage | State |');
    lines.push('|---|------|------|-------|-------|');
    for (let i = 0; i < s.tables.length; i++) {
      const t = s.tables[i];
      const keys = t.keys.slice(0, 5).join(', ') + (t.keys.length > 5 ? ` (+${t.keys.length - 5})` : '');
      lines.push(`| ${i + 1} | ${t.name} | ${t.keyCount} | ${t.usageCount} | ${t.isState ? '📋' : '—'} |`);
      if (t.keys.length > 0) {
        lines.push(`     Keys: ${keys}`);
      }
    }
    lines.push('');
  }

  // Events
  if (s.events.length > 0) {
    lines.push(`## Events (${s.events.length})`);
    lines.push('');
    for (const e of s.events) {
      lines.push(`- ${e.type}: ${e.name} (L${e.line})`);
    }
    lines.push('');
  }

  // Loops
  if (s.loops.length > 0) {
    lines.push(`## Loops (${s.loops.length})`);
    lines.push('');
    lines.push('| # | Name | Lines | Wait | Pcall | Interval |');
    lines.push('|---|------|-------|------|-------|----------|');
    for (let i = 0; i < s.loops.length; i++) {
      const l = s.loops[i];
      const wait = l.hasWait ? '✅' : '❌';
      const pcall = l.hasPcall ? '✅' : '❌';
      lines.push(`| ${i + 1} | ${l.name} | ${l.lineCount} | ${wait} | ${pcall} | ${l.interval || '—'} |`);
    }
    lines.push('');
  }

  // Constants
  if (s.constants.length > 0) {
    lines.push(`## Constants (${s.constants.length})`);
    lines.push('');
    for (const c of s.constants) {
      lines.push(`- ${c.name} = ${c.value.slice(0, 80)} (L${c.line})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
