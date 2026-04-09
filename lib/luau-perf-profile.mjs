#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau Perf Profile — Static Performance Profiler
// ──────────────────────────────────────────────

export function runLuauPerfProfile(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { fileName: path.basename(filePath), error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');

  const issues = [];

  // 1. FindFirstChild in loops
  issues.push(...scanFindFirstChildInLoops(source, lines));

  // 2. Un cached GetService
  issues.push(...scanUnCachedGetService(source, lines));

  // 3. Table creation in loops
  issues.push(...scanTableCreationInLoops(source, lines));

  // 4. String concat in hot paths
  issues.push(...scanStringConcatHotPaths(source, lines));

  // 5. Repeated module requires
  issues.push(...scanRepeatedRequires(source, lines));

  // 6. Inline functions in loops (closure creation)
  issues.push(...scanInlineFunctionsInLoops(source, lines));

  // 7. Global lookups in loops (game.Workspace vs cached)
  issues.push(...scanGlobalLookupsInLoops(source, lines));

  // 8. Unnecessary ipairs/pairs iterations
  issues.push(...scanInefficientIteration(source, lines));

  // Score and classify
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const issue of issues) {
    switch (issue.severity) {
      case 'CRITICAL': criticalCount++; break;
      case 'HIGH': highCount++; break;
      case 'MEDIUM': mediumCount++; break;
      case 'LOW': lowCount++; break;
    }
  }

  // Overall score: 0-100 (100 = perfect)
  const penalty = criticalCount * 15 + highCount * 8 + mediumCount * 3 + lowCount * 1;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  let verdict;
  if (criticalCount > 0) verdict = 'POOR';
  else if (highCount > 3) verdict = 'BELOW_AVG';
  else if (highCount > 0) verdict = 'AVG';
  else if (mediumCount > 5) verdict = 'GOOD';
  else verdict = 'EXCELLENT';

  return {
    fileName: path.basename(filePath),
    filePath: absPath,
    totalLines: lines.length,
    issues,
    severityCounts: { critical: criticalCount, high: highCount, medium: mediumCount, low: lowCount },
    score,
    verdict,
    byCategory: categorizeIssues(issues),
  };
}

// ─── Scanners ───

function scanFindFirstChildInLoops(source, lines) {
  const issues = [];
  const loopRanges = findLoopRanges(source, lines);

  for (const loop of loopRanges) {
    for (let i = loop.startLine; i <= loop.endLine; i++) {
      const line = lines[i - 1];
      const ffcMatch = line.match(/:FindFirstChild\s*\(\s*["']([^"']+)["']\s*\)/);
      if (ffcMatch) {
        issues.push({
          severity: 'CRITICAL',
          category: 'loop-cache',
          type: 'FindFirstChild in loop',
          line: i,
          detail: `:FindFirstChild("${ffcMatch[1]}") in loop — cache before loop`,
          suggestion: `Cache "${ffcMatch[1]}" before the loop starts`,
        });
      }
      const wfcMatch = line.match(/:WaitForChild\s*\(\s*["']([^"']+)["']\s*\)/);
      if (wfcMatch && loop.type === 'taskSpawn') {
        issues.push({
          severity: 'HIGH',
          category: 'loop-cache',
          type: 'WaitForChild in spawned loop',
          line: i,
          detail: `:WaitForChild("${wfcMatch[1]}") in taskSpawn loop — blocks entire loop`,
          suggestion: `Use :FindFirstChild() or cache before spawn`,
        });
      }
    }
  }

  return issues;
}

function scanUnCachedGetService(source, lines) {
  const issues = [];
  const servicePattern = /game\s*:\s*GetService\s*\(\s*["'](\w+)["']\s*\)/g;
  let match;

  // Count occurrences of same service
  const serviceCalls = [];
  while ((match = servicePattern.exec(source)) !== null) {
    serviceCalls.push({
      service: match[1],
      line: source.slice(0, match.index).split('\n').length,
    });
  }

  // Group by service name
  const serviceMap = new Map();
  for (const call of serviceCalls) {
    if (!serviceMap.has(call.service)) serviceMap.set(call.service, []);
    serviceMap.get(call.service).push(call.line);
  }

  // Check if cached at top level
  for (const [service, lineNums] of serviceMap) {
    if (lineNums.length > 1) {
      issues.push({
        severity: 'HIGH',
        category: 'caching',
        type: 'Un-cached GetService',
        line: lineNums[1],
        detail: `GetService("${service}") called ${lineNums.length} times — cache to a local`,
        suggestion: `local ${service.toLowerCase()} = game:GetService("${service}")`,
        repeatLines: lineNums.slice(1),
      });
    }
  }

  return issues;
}

function scanTableCreationInLoops(source, lines) {
  const issues = [];
  const loopRanges = findLoopRanges(source, lines);

  for (const loop of loopRanges) {
    for (let i = loop.startLine; i <= loop.endLine; i++) {
      const line = lines[i - 1];
      // Table literal creation: { ... }
      if (/\{[^}]{5,}\}/.test(line) && !/^\s*--/.test(line)) {
        // Skip small tables (likely not perf-critical)
        if (line.match(/\{/g).length >= 1) {
          issues.push({
            severity: 'MEDIUM',
            category: 'loop-cache',
            type: 'Table creation in loop',
            line: i,
            detail: 'New table allocated each iteration — hoist outside loop',
            suggestion: 'Create table before loop and reuse/clear it',
          });
        }
      }
    }
  }

  return issues;
}

function scanStringConcatHotPaths(source, lines) {
  const issues = [];

  // String concat with .. in loops
  const loopRanges = findLoopRanges(source, lines);
  for (const loop of loopRanges) {
    for (let i = loop.startLine; i <= loop.endLine; i++) {
      const line = lines[i - 1];
      if (/\w+\s*\.\.\s*\w+/.test(line) || /str_fmt\s*\(/.test(line)) {
        issues.push({
          severity: 'MEDIUM',
          category: 'string-perf',
          type: 'String concat in loop',
          line: i,
          detail: 'String concatenation in loop — use table.concat or cached format',
          suggestion: 'Accumulate strings in a table and use table.concat()',
        });
      }
    }
  }

  // Excessive string.format calls
  const fmtCalls = [];
  const fmtRegex = /string\.format\s*\(/g;
  let match;
  while ((match = fmtRegex.exec(source)) !== null) {
    fmtCalls.push(source.slice(0, match.index).split('\n').length);
  }
  if (fmtCalls.length > 5) {
    issues.push({
      severity: 'LOW',
      category: 'string-perf',
      type: 'Many string.format calls',
      line: fmtCalls[0],
      detail: `${fmtCalls.length} string.format() calls — consider caching formatted strings`,
      suggestion: 'Pre-format constant strings or cache results',
    });
  }

  return issues;
}

function scanRepeatedRequires(source, lines) {
  const issues = [];
  const requireRegex = /require\s*\(\s*([^)]+)\s*\)/g;
  const requireMap = new Map();
  let match;

  while ((match = requireRegex.exec(source)) !== null) {
    const mod = match[1].trim();
    if (!requireMap.has(mod)) requireMap.set(mod, []);
    requireMap.get(mod).push(source.slice(0, match.index).split('\n').length);
  }

  for (const [mod, lineNums] of requireMap) {
    if (lineNums.length > 1) {
      issues.push({
        severity: 'HIGH',
        category: 'caching',
        type: 'Repeated require',
        line: lineNums[1],
        detail: `require(${mod}) called ${lineNums.length} times — first call caches`,
        suggestion: `Cache require result: local mod = ${mod}`,
        repeatLines: lineNums.slice(1),
      });
    }
  }

  return issues;
}

function scanInlineFunctionsInLoops(source, lines) {
  const issues = [];
  const loopRanges = findLoopRanges(source, lines);

  for (const loop of loopRanges) {
    for (let i = loop.startLine; i <= loop.endLine; i++) {
      const line = lines[i - 1];
      // function() inside loop body creates new closure each iteration
      if (/function\s*\(/.test(line) && !/^\s*local\s+function\s+\w+/.test(line)) {
        issues.push({
          severity: 'MEDIUM',
          category: 'closure',
          type: 'Inline function in loop',
          line: i,
          detail: 'New closure created each loop iteration',
          suggestion: 'Define function outside loop and reference it',
        });
      }
    }
  }

  return issues;
}

function scanGlobalLookupsInLoops(source, lines) {
  const issues = [];
  const loopRanges = findLoopRanges(source, lines);
  const globals = ['game', 'workspace', 'game.Workspace', 'script', 'shared'];

  for (const loop of loopRanges) {
    for (let i = loop.startLine; i <= loop.endLine; i++) {
      const line = lines[i - 1];
      for (const global of globals) {
        const escaped = global.replace(/\./g, '\\.');
        const regex = new RegExp(`(?<!local\\s+)\\b${escaped}\\b`, 'g');
        if (regex.test(line) && !/^\s*--/.test(line)) {
          issues.push({
            severity: 'LOW',
            category: 'global-lookup',
            type: 'Global lookup in loop',
            line: i,
            detail: `${global} accessed in loop — cache to local`,
            suggestion: `local _${global.replace(/\./g, '_')} = ${global} before loop`,
          });
          break; // One per line is enough
        }
      }
    }
  }

  return issues;
}

function scanInefficientIteration(source, lines) {
  const issues = [];

  // ipairs for numeric index only (no value used)
  const ipairsOnlyIdx = /for\s+\w+\s*,\s*_\s+in\s+ipairs/.test(source) ? null : null;

  // Pattern: for i, v in ipairs(t) but only uses i
  const ipairsRegex2 = /for\s+(\w+)\s*,\s*(\w+)\s+in\s+ipairs\s*\(/g;
  let match;
  while ((match = ipairsRegex2.exec(source)) !== null) {
    const idxVar = match[1];
    const valVar = match[2];
    const lineNum = source.slice(0, match.index).split('\n').length;

    // Check if valVar is actually used in the next 30 lines
    const context = getContextAfter(source, match.index, 1000);
    if (!context.includes(valVar + '[') && !context.includes(valVar + '.') && !context.includes('=' + valVar)) {
      // Check it's not used as a parameter
      const paramUse = context.match(new RegExp(`\\b${valVar}\\b`, 'g'));
      if (!paramUse || paramUse.length <= 1) {
        issues.push({
          severity: 'LOW',
          category: 'iteration',
          type: 'Unused value in ipairs',
          line: lineNum,
          detail: `Loop variable "${valVar}" is declared but not used`,
          suggestion: `Use: for ${idxVar} = 1, #t do`,
        });
      }
    }
  }

  // # operator vs ipairs (when only iterating, # is faster)
  // pairs when ipairs would work (numeric arrays)

  return issues;
}

// ─── Helpers ───

function findLoopRanges(source, lines) {
  const loops = [];

  // taskSpawn loops
  const taskSpawnRegex = /taskSpawn\s*\(\s*function/g;
  let match;
  while ((match = taskSpawnRegex.exec(source)) !== null) {
    const startLine = source.slice(0, match.index).split('\n').length;
    const endLine = findEndOfFunction(lines, startLine);
    loops.push({ type: 'taskSpawn', startLine, endLine });
  }

  // while loops
  const whileRegex = /while\s+(true|\w+)\s+do/g;
  while ((match = whileRegex.exec(source)) !== null) {
    const startLine = source.slice(0, match.index).split('\n').length;
    const endLine = findMatchingEnd(lines, startLine, 'while');
    loops.push({ type: 'while', startLine, endLine });
  }

  // for loops
  const forRegex = /for\s+\w+\s*=/g;
  while ((match = forRegex.exec(source)) !== null) {
    const startLine = source.slice(0, match.index).split('\n').length;
    const endLine = findMatchingEnd(lines, startLine, 'for');
    loops.push({ type: 'for', startLine, endLine });
  }

  return loops;
}

function findEndOfFunction(lines, startIdx) {
  let depth = 1;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('--') || line.startsWith('[[')) continue;
    depth += (line.match(/\bfunction\b/g) || []).length;
    depth -= (line.match(/^\s*end\b/g) || []).length;
    if (depth <= 0) return i + 1;
  }
  return lines.length;
}

function findMatchingEnd(lines, startIdx, construct) {
  let depth = 1;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('--') || line.startsWith('[[')) continue;
    const opens = (line.match(new RegExp(`\\b(${construct}|function|if)\\b`, 'g')) || []).length;
    const closes = (line.match(/^\s*end\b/g) || []).length;
    depth += opens - closes;
    if (depth <= 0) return i + 1;
  }
  return lines.length;
}

function getContextAfter(source, index, length) {
  return source.slice(index, Math.min(source.length, index + length));
}

function categorizeIssues(issues) {
  const categories = {};
  for (const issue of issues) {
    const cat = issue.category || 'other';
    if (!categories[cat]) categories[cat] = { count: 0, critical: 0, high: 0 };
    categories[cat].count++;
    if (issue.severity === 'CRITICAL') categories[cat].critical++;
    else if (issue.severity === 'HIGH') categories[cat].high++;
  }
  return categories;
}

// ─── Renderer ───

export function renderLuauPerfProfile(result) {
  if (result.error) {
    return `[LUAU PERF PROFILE] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push(`[LUAU PERF PROFILE] ${result.fileName}`);
  lines.push('═'.repeat(52));
  lines.push(`  Lines:             ${result.totalLines}`);
  lines.push(`  Performance score: ${result.score}/100`);
  lines.push(`  Issues found:      ${result.issues.length}`);
  lines.push('');

  const severityIcon = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' };

  // Critical first
  const sorted = [...result.issues].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (order[a.severity] || 4) - (order[b.severity] || 4);
  });

  for (const issue of sorted) {
    const icon = severityIcon[issue.severity] || '?';
    lines.push(`  ${icon} [${issue.severity}] ${issue.type} (L${issue.line})`);
    lines.push(`     ${issue.detail}`);
    if (issue.suggestion) lines.push(`     → ${issue.suggestion}`);
    lines.push('');
  }

  // Category summary
  if (Object.keys(result.byCategory).length > 0) {
    lines.push('── Category Summary ──────────────────────────────');
    for (const [cat, info] of Object.entries(result.byCategory)) {
      lines.push(`  ${cat}: ${info.count} issues (${info.critical} critical, ${info.high} high)`);
    }
    lines.push('');
  }

  lines.push('═'.repeat(52));
  lines.push(`  Verdict: ${result.verdict} (${result.score}/100)`);
  lines.push('═'.repeat(52));

  return lines.join('\n');
}
