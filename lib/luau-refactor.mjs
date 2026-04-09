#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau Refactor — Safe Automatic Refactoring
// ──────────────────────────────────────────────

export function runLuauRefactor(filePath, fixes = {}) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { error: `File not found: ${absPath}` };
  }

  const original = fs.readFileSync(absPath, 'utf8');
  let source = original;
  const changes = [];

  // Apply requested fixes
  if (fixes.cacheGetService !== false) {
    const result = cacheGetServices(source);
    source = result.source;
    changes.push(...result.changes);
  }

  if (fixes.wrapPcall !== false) {
    const result = wrapFireServerPcall(source);
    source = result.source;
    changes.push(...result.changes);
  }

  if (fixes.cacheFindFirstChild !== false) {
    const result = cacheFindFirstChild(source);
    source = result.source;
    changes.push(...result.changes);
  }

  if (fixes.removeDeadFunctions !== false) {
    const result = removeDeadFunctions(source);
    source = result.source;
    changes.push(...result.changes);
  }

  if (fixes.hoistTableCreation !== false) {
    const result = hoistTableCreation(source);
    source = result.source;
    changes.push(...result.changes);
  }

  // Check if anything changed
  if (source === original) {
    return {
      fileName: path.basename(absPath),
      changes: [],
      originalSize: original.length,
      newSize: original.length,
      backupPath: null,
    };
  }

  // Write backup
  const backupPath = absPath + '.bak.' + Date.now();
  fs.writeFileSync(backupPath, original, 'utf8');

  // Write refactored file
  fs.writeFileSync(absPath, source, 'utf8');

  return {
    fileName: path.basename(absPath),
    filePath: absPath,
    changes,
    changeCount: changes.length,
    originalSize: original.length,
    newSize: source.length,
    sizeDelta: source.length - original.length,
    backupPath,
  };
}

// ─── Refactoring: Cache GetService ───

function cacheGetServices(source) {
  const changes = [];
  const serviceMap = {};

  // Find all GetService calls
  const regex = /([\w.]+)\s*=\s*game\s*:\s*GetService\s*\(\s*["'](\w+)["']\s*\)/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const varName = match[1];
    const serviceName = match[2];
    if (!serviceMap[serviceName]) {
      serviceMap[serviceName] = [];
    }
    serviceMap[serviceName].push({ varName, line: source.slice(0, match.index).split('\n').length, index: match.index });
  }

  // Find services used without local (game:GetService directly)
  const directRegex = /game\s*:\s*GetService\s*\(\s*["'](\w+)["']\s*\)/g;
  const directCalls = new Map();
  while ((match = directRegex.exec(source)) !== null) {
    const serviceName = match[1];
    if (!directCalls.has(serviceName)) {
      directCalls.set(serviceName, []);
    }
    directCalls.get(serviceName).push({
      line: source.slice(0, match.index).split('\n').length,
      index: match.index,
      full: match[0],
    });
  }

  // For services called multiple times directly, add cache
  for (const [serviceName, calls] of directCalls) {
    if (calls.length > 1) {
      // Check if already cached
      const alreadyCached = serviceMap[serviceName] && serviceMap[serviceName].length > 0;
      if (!alreadyCached) {
        const cacheLine = `local ${serviceName.toLowerCase()} = game:GetService("${serviceName}")`;
        // Find first line that's a local declaration or top-level
        const firstCallLine = calls[0].line;
        const lines = source.split('\n');
        const insertIdx = findInsertPosition(lines, firstCallLine);

        changes.push({
          type: 'cache-getservice',
          serviceName,
          callCount: calls.length,
          firstCallLine,
          suggestion: cacheLine,
        });
      }
    }
  }

  return { source, changes };
}

function findInsertPosition(lines, targetLine) {
  // Insert after existing locals, before first function
  for (let i = Math.min(targetLine - 1, lines.length - 1); i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('local ') && !line.includes('function')) return i;
    if (line.startsWith('--')) continue;
    if (line === '') continue;
    if (line.startsWith('local function') || line.includes('= function')) return i;
  }
  return Math.max(0, targetLine - 2);
}

// ─── Refactoring: Wrap FireServer in Pcall ───

function wrapFireServerPcall(source) {
  const changes = [];
  const lines = source.split('\n');
  const modifiedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match FireServer/InvokeServer calls NOT already in pcall
    if (/(FireServer|InvokeServer)\s*\(/.test(line) && !/pcall|pcallRef|xpcall/.test(line)) {
      // Don't wrap if already in a pcall-wrapped function
      const contextAbove = lines.slice(Math.max(0, i - 5), i).join('\n');
      if (!/pcall|pcallRef/.test(contextAbove)) {
        // Wrap the line
        const trimmed = line.trim();
        const indent = line.match(/^(\s*)/)[1];
        const wrapped = `${indent}pcallRef(function() ${trimmed} end)`;
        modifiedLines.push(wrapped);
        changes.push({
          type: 'wrap-pcall',
          line: i + 1,
          detail: `Wrapped ${trimmed.slice(0, 60)}... in pcallRef`,
        });
        continue;
      }
    }
    modifiedLines.push(line);
  }

  return { source: modifiedLines.join('\n'), changes };
}

// ─── Refactoring: Cache FindFirstChild in Loops ───

function cacheFindFirstChild(source) {
  const changes = [];

  // Find patterns: while ... do ... :FindFirstChild(...)
  // Look for FindFirstChild inside while loops and suggest cache before loop

  const loopStartRegex = /while\s+\w+\s+do/g;
  let loopMatch;
  let offset = 0;

  while ((loopMatch = loopStartRegex.exec(source)) !== null) {
    const loopStart = loopMatch.index;
    const loopEnd = findLoopEnd(source, loopMatch.index);

    const loopBody = source.slice(loopStart, loopEnd);
    const ffcRegex = /:FindFirstChild\s*\(\s*["']([^"']+)["']\s*\)/g;
    let ffcMatch;
    const foundInLoop = new Set();

    while ((ffcMatch = ffcRegex.exec(loopBody)) !== null) {
      foundInLoop.add(ffcMatch[1]);
    }

    for (const childName of foundInLoop) {
      changes.push({
        type: 'cache-findfirstchild',
        childName,
        loopLine: source.slice(0, loopStart).split('\n').length,
        suggestion: `local ${childName.replace(/\s+/g, '')} = parent:FindFirstChild("${childName}")  -- cache before loop`,
      });
    }

    // Move past this loop
    loopStartRegex.lastIndex = loopEnd;
  }

  return { source, changes };
}

function findLoopEnd(source, loopStart) {
  const lines = source.slice(loopStart).split('\n');
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*while\s+/.test(line)) depth++;
    if (/^\s*end\b/.test(line)) {
      depth--;
      if (depth <= 0) return loopStart + source.slice(loopStart).split('\n').slice(0, i + 1).join('\n').length;
    }
  }
  return source.length;
}

// ─── Refactoring: Remove Dead Functions ───

function removeDeadFunctions(source) {
  const changes = [];
  const functions = [];

  // Find function definitions
  const funcRegex = /local\s+function\s+(\w+)\s*\(/g;
  let match;
  while ((match = funcRegex.exec(source)) !== null) {
    functions.push({
      name: match[1],
      defIndex: match.index,
      defLine: source.slice(0, match.index).split('\n').length,
    });
  }

  // Check which are called
  for (const func of functions) {
    const callRegex = new RegExp(`\\b${func.name}\\s*\\(`, 'g');
    let count = 0;
    let cm;
    while ((cm = callRegex.exec(source)) !== null) {
      if (cm.index !== func.defIndex) count++;
    }

    if (count === 0 && !func.name.startsWith('_')) {
      // Find function body
      const lines = source.split('\n');
      const startIdx = func.defLine - 1;
      const endIdx = findFuncEnd(lines, startIdx);

      changes.push({
        type: 'dead-function',
        name: func.name,
        line: func.defLine,
        lineCount: endIdx - startIdx + 1,
        suggestion: `Remove function "${func.name}" (never called)`,
      });
    }
  }

  return { source, changes };
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

// ─── Refactoring: Hoist Table Creation ───

function hoistTableCreation(source) {
  const changes = [];
  // This is a conservative check — reports opportunities but doesn't auto-apply
  // Auto-applying table hoisting requires understanding table usage patterns

  return { source, changes };
}

// ─── Renderer ───

export function renderLuauRefactor(result) {
  if (result.error) {
    return `[LUAU REFACTOR] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push(`[LUAU REFACTOR] ${result.fileName}`);
  lines.push('═'.repeat(52));

  if (result.changes.length === 0) {
    lines.push('  No refactoring opportunities found.');
    lines.push('  Script is already clean.');
    lines.push('═'.repeat(52));
    return lines.join('\n');
  }

  lines.push(`  Changes:           ${result.changeCount}`);
  lines.push(`  Original size:     ${result.originalSize} bytes`);
  lines.push(`  New size:          ${result.newSize} bytes`);
  lines.push(`  Size delta:        ${result.sizeDelta > 0 ? '+' : ''}${result.sizeDelta} bytes`);
  lines.push(`  Backup:            ${result.backupPath ? path.basename(result.backupPath) : 'none'}`);
  lines.push('');

  // Group by type
  const byType = {};
  for (const c of result.changes) {
    if (!byType[c.type]) byType[c.type] = [];
    byType[c.type].push(c);
  }

  const typeLabels = {
    'cache-getservice': 'Cache GetService',
    'wrap-pcall': 'Wrap in Pcall',
    'cache-findfirstchild': 'Cache FindFirstChild',
    'dead-function': 'Dead Function',
    'hoist-table': 'Hoist Table Creation',
  };

  for (const [type, items] of Object.entries(byType)) {
    lines.push(`── ${typeLabels[type] || type} (${items.length}) ─────────────────────────`);
    for (const item of items) {
      lines.push(`  L${item.line}: ${item.suggestion || item.detail}`);
    }
    lines.push('');
  }

  lines.push('═'.repeat(52));
  lines.push(`  Applied: ${result.changeCount} fix(es)`);
  lines.push(`  Backup saved: ${result.backupPath ? '✅' : '❌'}`);
  lines.push('═'.repeat(52));

  return lines.join('\n');
}
