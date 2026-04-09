#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau Remote Map — Implementation
// ──────────────────────────────────────────────

export function runLuauRemoteMap(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { fileName: path.basename(filePath), error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');

  // Extract remote calls
  const remoteCalls = extractRemoteCalls(source, lines);
  // Extract handler connects
  const handlers = extractHandlers(source, lines);
  // Build remote directory
  const directory = buildDirectory(remoteCalls);
  // Build handler coverage
  const coverage = buildCoverage(remoteCalls, handlers);
  // Find unsafe remotes
  const unsafe = findUnsafeRemotes(remoteCalls, source);
  // Frequency analysis
  const frequency = buildFrequency(remoteCalls);
  // Argument analysis
  const argAnalysis = analyzeArguments(remoteCalls);

  // Verdict
  const totalPcall = remoteCalls.filter(c => c.pcallWrapped).length;
  const totalClientServer = remoteCalls.filter(c =>
    c.method === 'FireServer' || c.method === 'InvokeServer'
  ).length;
  const unprotectedClientServer = remoteCalls.filter(c =>
    (c.method === 'FireServer' || c.method === 'InvokeServer') && !c.pcallWrapped
  ).length;
  const inLoopNoWait = remoteCalls.filter(c =>
    c.context === 'loop' && !c.hasTaskWait
  );

  let verdict;
  if (unprotectedClientServer > 0) verdict = 'RISKY';
  else if (inLoopNoWait.length > 0) verdict = 'RISKY';
  else if (totalPcall < remoteCalls.length) verdict = 'WARN';
  else verdict = 'SAFE';

  return {
    fileName: path.basename(filePath),
    filePath: absPath,
    totalRemoteCalls: remoteCalls.length,
    uniqueRemotes: directory.length,
    handlerConnects: handlers.length,
    pcallWrapped: totalPcall,
    pcallPercentage: remoteCalls.length > 0
      ? Math.round((totalPcall / remoteCalls.length) * 100)
      : 100,
    directory,
    coverage,
    unsafe,
    frequency,
    argAnalysis,
    verdict,
  };
}

function extractRemoteCalls(source, lines) {
  const calls = [];
  const regex = /([\w.]+)\s*:\s*(FireServer|InvokeServer|FireClient|FireAllClients|InvokeClient)\s*\(/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const lineNum = source.slice(0, match.index).split('\n').length;
    const context = getContextAround(source, match.index, 200);
    const pcallWrapped = /pcall|pcallRef/.test(context.slice(0, 80));
    const inLoop = /while\s+/.test(context);
    const hasTaskWait = /task\.wait/.test(context);
    const inCallback = /Callback\s*=\s*function/.test(context);
    const inFunction = /^\s*local\s+function\s+\w+/.test(
      lines.slice(0, lineNum).reverse().find(l => /^\s*(local\s+)?function/.test(l)) || ''
    );

    let contextType = 'top-level';
    if (inLoop) contextType = 'loop';
    else if (inCallback) contextType = 'callback';
    else if (inFunction) contextType = 'function';

    // Extract arguments
    const argsStr = extractArgs(source, match.index + match[0].length - 1);
    const args = parseArgs(argsStr);

    calls.push({
      remote: match[1],
      method: match[2],
      line: lineNum,
      pcallWrapped,
      inLoop,
      hasTaskWait,
      context: contextType,
      args,
    });
  }

  return calls;
}

function extractHandlers(source, lines) {
  const handlers = [];
  const regex = /([\w.]+)\.(OnServerEvent|OnClientEvent|OnServerInvoke|OnClientInvoke)\s*:\s*Connect\s*\(/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const lineNum = source.slice(0, match.index).split('\n').length;
    handlers.push({
      remote: match[1],
      eventType: match[2],
      line: lineNum,
    });
  }

  return handlers;
}

function buildDirectory(calls) {
  const map = new Map();

  for (const call of calls) {
    const key = `${call.remote}:${call.method}`;
    if (!map.has(key)) {
      map.set(key, {
        remote: call.remote,
        method: call.method,
        callCount: 0,
        lines: [],
        pcallCount: 0,
        contexts: new Set(),
        argTypes: new Set(),
      });
    }
    const entry = map.get(key);
    entry.callCount++;
    entry.lines.push(call.line);
    if (call.pcallWrapped) entry.pcallCount++;
    entry.contexts.add(call.context);
    for (const arg of call.args) {
      entry.argTypes.add(arg.type);
    }
  }

  return Array.from(map.values()).map(e => ({
    ...e,
    contexts: Array.from(e.contexts),
    argTypes: Array.from(e.argTypes),
  }));
}

function buildCoverage(calls, handlers) {
  const coverage = [];
  const remoteMethods = new Set();

  for (const call of calls) {
    const key = `${call.remote}:${call.method}`;
    if (remoteMethods.has(key)) continue;
    remoteMethods.add(key);

    // Find corresponding handler
    let handlerType, status;
    switch (call.method) {
      case 'FireServer':
        handlerType = 'OnServerEvent:Connect';
        break;
      case 'InvokeServer':
        handlerType = 'OnServerInvoke:Connect';
        break;
      case 'FireClient':
      case 'FireAllClients':
        handlerType = 'OnClientEvent:Connect';
        break;
      case 'InvokeClient':
        handlerType = 'OnClientInvoke:Connect';
        break;
    }

    const hasHandler = handlers.some(h =>
      h.remote === call.remote && h.eventType === handlerType.split(':')[0]
    );

    // For client→server remotes, MISSING handler is normal (server handles in different script)
    if (call.method === 'FireServer' || call.method === 'InvokeServer') {
      status = hasHandler ? 'COVERED' : 'MISSING (server-side)';
    } else {
      status = hasHandler ? 'COVERED' : 'MISSING';
    }

    coverage.push({
      remote: call.remote,
      firedAs: call.method,
      handler: handlerType,
      status,
    });
  }

  return coverage;
}

function findUnsafeRemotes(calls, source) {
  const unsafe = [];

  for (const call of calls) {
    const reasons = [];

    if ((call.method === 'FireServer' || call.method === 'InvokeServer') && !call.pcallWrapped) {
      reasons.push(`Not pcall-wrapped`);
    }

    if (call.inLoop && !call.hasTaskWait) {
      reasons.push(`In loop without task.wait`);
    }

    if (call.method === 'InvokeServer' && call.inLoop) {
      reasons.push(`Blocking InvokeServer in loop`);
    }

    if (reasons.length > 0) {
      unsafe.push({ ...call, reasons });
    }
  }

  return unsafe;
}

function buildFrequency(calls) {
  const freqMap = new Map();

  for (const call of calls) {
    const key = call.remote;
    if (!freqMap.has(key)) {
      freqMap.set(key, { remote: key, count: 0, contexts: new Set(), inLoop: false, interval: null });
    }
    const entry = freqMap.get(key);
    entry.count++;
    entry.contexts.add(call.context);
    if (call.inLoop) {
      entry.inLoop = true;
      // Try to extract interval from nearby task.wait
      const context = getContextAround(calls.find(c => c.remote === key)?.line || 0, source, 100);
    }
  }

  return Array.from(freqMap.values()).map(e => ({
    ...e,
    contexts: Array.from(e.contexts),
  }));
}

function analyzeArguments(calls) {
  const stringActions = new Map();
  const tableArgs = [];

  for (const call of calls) {
    for (const arg of call.args) {
      if (arg.type === 'string' && arg.value) {
        if (!stringActions.has(call.remote)) {
          stringActions.set(call.remote, []);
        }
        stringActions.get(call.remote).push(arg.value);
      }
      if (arg.type === 'table') {
        tableArgs.push({ remote: call.remote, line: call.line });
      }
    }
  }

  return {
    stringActions: Array.from(stringActions.entries()).map(([remote, actions]) => ({
      remote,
      actions: [...new Set(actions)],
    })),
    tableArgs,
  };
}

// ─── Helpers ───

function getContextAround(source, index, range) {
  const start = Math.max(0, index - range);
  const end = Math.min(source.length, index + range);
  return source.slice(start, end);
}

function extractArgs(source, openParenIndex) {
  // Find matching closing paren
  let depth = 0;
  let start = -1;
  let end = -1;

  for (let i = openParenIndex; i < source.length && i < openParenIndex + 500; i++) {
    const ch = source[i];
    if (ch === '(') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (start === -1 || end === -1) return '';
  return source.slice(start, end).trim();
}

function parseArgs(argsStr) {
  if (!argsStr) return [];

  const args = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    else if (ch === '}' || ch === ')' || ch === ']') depth--;

    if (ch === ',' && depth === 0) {
      args.push(classifyArg(current.trim()));
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) {
    args.push(classifyArg(current.trim()));
  }

  return args;
}

function classifyArg(str) {
  if (str.startsWith('"') || str.startsWith("'")) {
    return { type: 'string', value: str.replace(/^["']|["']$/g, '') };
  }
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return { type: 'number', value: parseFloat(str) };
  }
  if (str === 'true' || str === 'false') {
    return { type: 'boolean', value: str === 'true' };
  }
  if (str === 'nil') {
    return { type: 'nil' };
  }
  if (str.startsWith('{')) {
    return { type: 'table' };
  }
  return { type: 'variable', name: str };
}

// ─── Renderer ───

export function renderLuauRemoteMap(result) {
  if (result.error) {
    return `[LUAU REMOTE MAP] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push(`[LUAU REMOTE MAP] ${result.fileName}`);
  lines.push('─'.repeat(50));
  lines.push(`Total remotes:     ${result.totalRemoteCalls}`);
  lines.push(`Unique remotes:    ${result.uniqueRemotes}`);
  lines.push(`Fire calls:        ${result.totalRemoteCalls}`);
  lines.push(`Handler connects:  ${result.handlerConnects}`);
  lines.push(`Pcall-wrapped:     ${result.pcallWrapped}/${result.totalRemoteCalls} (${result.pcallPercentage}%)`);
  lines.push('');
  lines.push('─'.repeat(50));
  lines.push('### Remote Directory');
  lines.push('');
  lines.padTableHeader && lines.push('| # | Remote | Method | Args | pcall | Line | Context |');
  lines.push('|---|--------|--------|------|-------|------|---------|');

  result.directory.forEach((entry, i) => {
    const pcallStatus = entry.pcallCount === entry.callCount ? '✅' : '❌';
    lines.push(`| ${i + 1} | ${entry.remote} | ${entry.method} | ${entry.argTypes.join(', ') || '—'} | ${pcallStatus} (${entry.pcallCount}/${entry.callCount}) | ${entry.lines.join(', ')} | ${entry.contexts.join(', ')} |`);
  });

  lines.push('');
  lines.push('### Handler Coverage');
  lines.push('');
  lines.push('| Remote | Fired As | Handler | Status |');
  lines.push('|--------|----------|---------|--------|');

  result.coverage.forEach(entry => {
    const statusIcon = entry.status === 'COVERED' ? '✅' : entry.status.startsWith('MISSING (server') ? '📡' : '❌';
    lines.push(`| ${entry.remote} | ${entry.firedAs} | ${entry.handler} | ${statusIcon} ${entry.status} |`);
  });

  if (result.unsafe.length > 0) {
    lines.push('');
    lines.push('### Unsafe Remotes (BLOCK)');
    lines.push('');
    lines.push('| Remote | Issue | Line |');
    lines.push('|--------|-------|------|');

    result.unsafe.forEach(entry => {
      lines.push(`| ${entry.remote} | ${entry.reasons.join('; ')} | ${entry.line} |`);
    });
  }

  if (result.argAnalysis.stringActions.length > 0) {
    lines.push('');
    lines.push('### Action Strings');
    lines.push('');
    lines.push('| Remote | Actions |');
    lines.push('|--------|---------|');

    result.argAnalysis.stringActions.forEach(entry => {
      lines.push(`| ${entry.remote} | ${entry.actions.map(a => `"${a}"`).join(', ')} |`);
    });
  }

  lines.push('');
  lines.push('─'.repeat(50));

  const coveredCount = result.coverage.filter(c => c.status === 'COVERED').length;
  const missingCount = result.coverage.filter(c => c.status.startsWith('MISSING')).length;

  lines.push(`Summary:`);
  lines.push(`  Covered handlers:    ${coveredCount}/${result.coverage.length}`);
  lines.push(`  Missing handlers:    ${missingCount} (expected — server-side)`);
  lines.push(`  Unsafe (no pcall):   ${result.unsafe.filter(u => u.reasons.some(r => r.includes('pcall'))).length}`);
  lines.push(`  Blocking in loop:    ${result.unsafe.filter(u => u.reasons.some(r => r.includes('loop'))).length}`);
  lines.push('');
  lines.push(`Verdict: ${result.verdict}`);
  lines.push('─'.repeat(50));

  return lines.join('\n');
}
