#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau Diff Report — Semantic Diff Between Versions
// ──────────────────────────────────────────────

export function runLuauDiffReport(oldPath, newPath) {
  const absOld = path.resolve(oldPath);
  const absNew = path.resolve(newPath);

  if (!fs.existsSync(absOld)) return { error: `Old file not found: ${absOld}` };
  if (!fs.existsSync(absNew)) return { error: `New file not found: ${absNew}` };

  const oldSource = fs.readFileSync(absOld, 'utf8');
  const newSource = fs.readFileSync(absNew, 'utf8');
  const oldLines = oldSource.split('\n');
  const newLines = newSource.split('\n');

  const changes = [];

  // 1. Function changes
  changes.push(...diffFunctions(oldSource, newSource, oldLines, newLines));

  // 2. Remote changes
  changes.push(...diffRemotes(oldSource, newSource));

  // 3. Feature changes
  changes.push(...diffFeatures(oldSource, newSource));

  // 4. Variable/constant changes
  changes.push(...diffVariables(oldSource, newSource));

  // 5. Line-level diff
  changes.push(...diffLines(oldLines, newLines));

  // 6. Size/structure changes
  const sizeChange = {
    oldLines: oldLines.length,
    newLines: newLines.length,
    lineDelta: newLines.length - oldLines.length,
    oldSize: fs.statSync(absOld).size,
    newSize: fs.statSync(absNew).size,
    sizeDelta: fs.statSync(absNew).size - fs.statSync(absOld).size,
  };

  // 7. Loop changes
  changes.push(...diffLoops(oldSource, newSource));

  // 8. UI framework changes
  changes.push(...diffUIFramework(oldSource, newSource));

  // Summary
  const added = changes.filter(c => c.changeType === 'added');
  const removed = changes.filter(c => c.changeType === 'removed');
  const modified = changes.filter(c => c.changeType === 'modified');
  const renamed = changes.filter(c => c.changeType === 'renamed');
  const moved = changes.filter(c => c.changeType === 'moved');

  let verdict;
  if (removed.length > modified.length && removed.length > added.length) verdict = 'REGRESSION';
  else if (added.length > removed.length * 2) verdict = 'EXPANSION';
  else if (modified.length > added.length + removed.length) verdict = 'RESTRUCTURE';
  else verdict = 'INCREMENTAL';

  return {
    oldFile: path.basename(absOld),
    newFile: path.basename(absNew),
    sizeChange,
    changes,
    summary: { added: added.length, removed: removed.length, modified: modified.length, renamed: renamed.length, moved: moved.length },
    verdict,
  };
}

// ─── Differs ───

function diffFunctions(oldSource, newSource, oldLines, newLines) {
  const changes = [];
  const oldFuncs = extractFunctions(oldSource);
  const newFuncs = extractFunctions(newSource);

  const oldNames = new Set(oldFuncs.map(f => f.name));
  const newNames = new Set(newFuncs.map(f => f.name));

  // Added functions
  for (const func of newFuncs) {
    if (!oldNames.has(func.name)) {
      changes.push({
        changeType: 'added',
        category: 'function',
        name: func.name,
        detail: `New function "${func.name}" (+${func.lineCount} lines)`,
        line: func.line,
        file: 'new',
      });
    }
  }

  // Removed functions
  for (const func of oldFuncs) {
    if (!newNames.has(func.name)) {
      changes.push({
        changeType: 'removed',
        category: 'function',
        name: func.name,
        detail: `Function "${func.name}" removed (was ${func.lineCount} lines)`,
        line: func.line,
        file: 'old',
      });
    }
  }

  // Modified functions (size change > 20%)
  for (const newFunc of newFuncs) {
    const oldFunc = oldFuncs.find(f => f.name === newFunc.name);
    if (!oldFunc) continue;

    const sizeChange = oldFunc.lineCount > 0
      ? Math.abs(newFunc.lineCount - oldFunc.lineCount) / oldFunc.lineCount
      : 0;

    if (sizeChange > 0.2) {
      const direction = newFunc.lineCount > oldFunc.lineCount ? 'grew' : 'shrank';
      changes.push({
        changeType: 'modified',
        category: 'function',
        name: newFunc.name,
        detail: `Function "${newFunc.name}" ${direction} ${oldFunc.lineCount}→${newFunc.lineCount} lines (${Math.round(sizeChange * 100)}%)`,
        line: newFunc.line,
        oldLine: oldFunc.line,
      });
    }
  }

  return changes;
}

function diffRemotes(oldSource, newSource) {
  const changes = [];
  const oldRemotes = extractRemoteCalls(oldSource);
  const newRemotes = extractRemoteCalls(newSource);

  const oldSet = new Set(oldRemotes.map(r => `${r.remote}:${r.method}`));
  const newSet = new Set(newRemotes.map(r => `${r.remote}:${r.method}`));

  for (const key of newSet) {
    if (!oldSet.has(key)) {
      const [remote, method] = key.split(':');
      changes.push({
        changeType: 'added',
        category: 'remote',
        name: key,
        detail: `New remote call ${remote}:${method}`,
        file: 'new',
      });
    }
  }

  for (const key of oldSet) {
    if (!newSet.has(key)) {
      const [remote, method] = key.split(':');
      changes.push({
        changeType: 'removed',
        category: 'remote',
        name: key,
        detail: `Remote call ${remote}:${method} removed`,
        file: 'old',
      });
    }
  }

  // Count changes
  const oldCounts = countRemoteCalls(oldSource);
  const newCounts = countRemoteCalls(newSource);
  for (const key of newSet) {
    const oldCount = oldCounts[key] || 0;
    const newCount = newCounts[key] || 0;
    if (newCount !== oldCount && oldCount > 0) {
      changes.push({
        changeType: 'modified',
        category: 'remote',
        name: key,
        detail: `${key} calls: ${oldCount}→${newCount}`,
      });
    }
  }

  return changes;
}

function diffFeatures(oldSource, newSource) {
  const changes = [];
  const oldFeats = extractFeatureNames(oldSource);
  const newFeats = extractFeatureNames(newSource);

  for (const name of newFeats) {
    if (!oldFeats.has(name)) {
      changes.push({
        changeType: 'added',
        category: 'feature',
        name,
        detail: `New feature "${name}"`,
        file: 'new',
      });
    }
  }

  for (const name of oldFeats) {
    if (!newFeats.has(name)) {
      changes.push({
        changeType: 'removed',
        category: 'feature',
        name,
        detail: `Feature "${name}" removed`,
        file: 'old',
      });
    }
  }

  return changes;
}

function diffVariables(oldSource, newSource) {
  const changes = [];

  // Top-level locals
  const oldVars = extractTopLocals(oldSource);
  const newVars = extractTopLocals(newSource);

  const oldNames = new Set(oldVars.map(v => v.name));
  const newNames = new Set(newVars.map(v => v.name));

  for (const name of newNames) {
    if (!oldNames.has(name)) {
      changes.push({
        changeType: 'added',
        category: 'variable',
        name,
        detail: `New variable "${name}"`,
        file: 'new',
      });
    }
  }

  for (const name of oldNames) {
    if (!newNames.has(name)) {
      changes.push({
        changeType: 'removed',
        category: 'variable',
        name,
        detail: `Variable "${name}" removed`,
        file: 'old',
      });
    }
  }

  return changes;
}

function diffLines(oldLines, newLines) {
  const changes = [];

  // Simple LCS-based diff for large structural changes
  const added = newLines.length - oldLines.length;
  if (Math.abs(added) > oldLines.length * 0.1) {
    changes.push({
      changeType: added > 0 ? 'added' : 'removed',
      category: 'structure',
      name: 'file-size',
      detail: `File ${added > 0 ? 'grew' : 'shrank'} by ${Math.abs(added)} lines (${Math.abs(Math.round(added / oldLines.length * 100))}%)`,
    });
  }

  return changes;
}

function diffLoops(oldSource, newSource) {
  const changes = [];
  const oldLoops = countLoops(oldSource);
  const newLoops = countLoops(newSource);

  const delta = newLoops - oldLoops;
  if (delta !== 0) {
    changes.push({
      changeType: delta > 0 ? 'added' : 'removed',
      category: 'loop',
      name: `loops:${Math.abs(delta)}`,
      detail: `${Math.abs(delta)} loop(s) ${delta > 0 ? 'added' : 'removed'} (${oldLoops}→${newLoops})`,
    });
  }

  return changes;
}

function diffUIFramework(oldSource, newSource) {
  const changes = [];
  const oldFw = detectUIFramework(oldSource);
  const newFw = detectUIFramework(newSource);

  if (oldFw !== newFw) {
    changes.push({
      changeType: 'modified',
      category: 'ui-framework',
      name: `framework:${oldFw}→${newFw}`,
      detail: `UI framework changed: ${oldFw} → ${newFw}`,
    });
  }

  // Tab changes
  const oldTabs = extractTabs(oldSource);
  const newTabs = extractTabs(newSource);

  for (const tab of newTabs) {
    if (!oldTabs.includes(tab)) {
      changes.push({
        changeType: 'added',
        category: 'ui-tab',
        name: tab,
        detail: `New UI tab "${tab}"`,
        file: 'new',
      });
    }
  }

  for (const tab of oldTabs) {
    if (!newTabs.includes(tab)) {
      changes.push({
        changeType: 'removed',
        category: 'ui-tab',
        name: tab,
        detail: `UI tab "${tab}" removed`,
        file: 'old',
      });
    }
  }

  return changes;
}

// ─── Extractors ───

function extractFunctions(source) {
  const funcs = [];
  const regex = /(?:local\s+function\s+(\w+)|local\s+(\w+)\s*=\s*function|function\s+(\w+)(?::\w+)?)\s*\(?/g;
  let match;
  const lines = source.split('\n');

  while ((match = regex.exec(source)) !== null) {
    const name = match[1] || match[2] || match[3] || '<anonymous>';
    const startLine = source.slice(0, match.index).split('\n').length;
    const endLine = findFuncEnd(lines, startLine - 1);
    funcs.push({ name, line: startLine, lineCount: endLine - startLine + 1 });
  }

  return funcs;
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

function extractRemoteCalls(source) {
  const remotes = [];
  const regex = /([\w.]+)\s*:\s*(FireServer|InvokeServer|FireClient|FireAllClients|InvokeClient)\s*\(/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    remotes.push({ remote: match[1], method: match[2] });
  }
  return remotes;
}

function countRemoteCalls(source) {
  const counts = {};
  const regex = /([\w.]+)\s*:\s*(FireServer|InvokeServer|FireClient|FireAllClients|InvokeClient)\s*\(/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const key = `${match[1]}:${match[2]}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function extractFeatureNames(source) {
  const names = new Set();
  const patterns = [
    /Title\s*=\s*["']([^"']+)["']/gi,
    /Name\s*=\s*["']([^"']+)["']/gi,
  ];
  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(source)) !== null) {
      if (match[1].length > 2 && match[1].length < 60) {
        names.add(match[1]);
      }
    }
  }
  return names;
}

function extractTopLocals(source) {
  const vars = [];
  const regex = /^\s*local\s+(\w+)\s*=/gm;
  let match;
  while ((match = regex.exec(source)) !== null) {
    vars.push({ name: match[1], line: source.slice(0, match.index).split('\n').length });
  }
  return vars;
}

function countLoops(source) {
  const count = (source.match(/taskSpawn\s*\(\s*function/g) || []).length +
                (source.match(/^\s*while\s+/gm) || []).length +
                (source.match(/^\s*for\s+/gm) || []).length;
  return count;
}

function detectUIFramework(source) {
  if (/LibSixtyTen/.test(source)) return 'LibSixtyTen';
  if (/Obsidian/.test(source)) return 'Obsidian';
  if (/Orion/.test(source)) return 'Orion';
  if (/Fluent/.test(source)) return 'Fluent';
  return 'Unknown';
}

function extractTabs(source) {
  const tabs = [];
  const regex = /AddTab\s*\(\s*["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(source)) !== null) tabs.push(match[1]);
  return tabs;
}

// ─── Renderer ───

export function renderLuauDiffReport(result) {
  if (result.error) {
    return `[LUAU DIFF REPORT] ERROR\n${result.error}`;
  }

  const lines = [];
  const sc = result.sizeChange;

  lines.push(`[LUAU DIFF REPORT] ${result.oldFile} → ${result.newFile}`);
  lines.push('═'.repeat(52));
  lines.push(`  Old:  ${sc.oldLines} lines, ${formatBytes(sc.oldSize)}`);
  lines.push(`  New:  ${sc.newLines} lines, ${formatBytes(sc.newSize)}`);
  lines.push(`  Δ:    ${sc.lineDelta > 0 ? '+' : ''}${sc.lineDelta} lines, ${sc.sizeDelta > 0 ? '+' : ''}${formatBytes(Math.abs(sc.sizeDelta))}`);
  lines.push('');

  const changeIcon = {
    added: '➕',
    removed: '➖',
    modified: '🔄',
    renamed: '✏️',
    moved: '📦',
  };

  // Group by category
  const byCategory = {};
  for (const c of result.changes) {
    const cat = c.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(c);
  }

  const categoryOrder = ['function', 'feature', 'remote', 'ui-framework', 'ui-tab', 'loop', 'variable', 'structure'];
  for (const cat of categoryOrder) {
    const items = byCategory[cat];
    if (!items || items.length === 0) continue;

    lines.push(`── ${cat.charAt(0).toUpperCase() + cat.slice(1)} (${items.length}) ─────────────────────────`);
    for (const item of items) {
      const icon = changeIcon[item.changeType] || '?';
      lines.push(`  ${icon} ${item.detail}`);
    }
    lines.push('');
  }

  // Remaining categories not in order
  for (const [cat, items] of Object.entries(byCategory)) {
    if (categoryOrder.includes(cat)) continue;
    lines.push(`── ${cat.charAt(0).toUpperCase() + cat.slice(1)} (${items.length}) ─────────────────────────`);
    for (const item of items) {
      const icon = changeIcon[item.changeType] || '?';
      lines.push(`  ${icon} ${item.detail}`);
    }
    lines.push('');
  }

  lines.push('── Summary ──────────────────────────────────────');
  lines.push(`  Added:     ${result.summary.added}`);
  lines.push(`  Removed:   ${result.summary.removed}`);
  lines.push(`  Modified:  ${result.summary.modified}`);
  lines.push(`  Renamed:   ${result.summary.renamed}`);
  lines.push('');

  lines.push('═'.repeat(52));
  lines.push(`  Verdict: ${result.verdict}`);
  lines.push('═'.repeat(52));

  return lines.join('\n');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
