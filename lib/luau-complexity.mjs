#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau Complexity Analysis — Implementation
// ──────────────────────────────────────────────

export function runLuauComplexity(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { fileName: path.basename(filePath), error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');

  // Extract functions
  const functions = extractFunctions(source, lines);

  // Analyze each function
  const results = functions.map(fn => analyzeFunction(fn, source, lines));

  // File-level stats
  const totalComplexity = results.reduce((sum, r) => sum + r.complexity, 0);
  const avgComplexity = results.length > 0 ? Math.round(totalComplexity / results.length) : 0;
  const maxComplexity = results.length > 0 ? Math.max(...results.map(r => r.complexity)) : 0;
  const maxNesting = results.length > 0 ? Math.max(...results.map(r => r.maxNesting)) : 0;
  const maxLineCount = results.length > 0 ? Math.max(...results.map(r => r.lineCount)) : 0;

  // Classification counts
  let simpleCount = 0, moderateCount = 0, complexCount = 0, unmaintainableCount = 0;
  for (const r of results) {
    switch (r.classification) {
      case 'Simple': simpleCount++; break;
      case 'Moderate': moderateCount++; break;
      case 'Complex': complexCount++; break;
      case 'Unmaintainable': unmaintainableCount++; break;
    }
  }

  return {
    fileName: path.basename(filePath),
    filePath: absPath,
    totalLines: lines.length,
    functionCount: results.length,
    totalComplexity,
    avgComplexity,
    maxComplexity,
    maxNesting,
    maxLineCount,
    functions: results,
    classificationCounts: { simple: simpleCount, moderate: moderateCount, complex: complexCount, unmaintainable: unmaintainableCount },
  };
}

function extractFunctions(source, lines) {
  const functions = [];

  // Pattern 1: local function name(
  // Pattern 2: local name = function(
  // Pattern 3: function Module:name(
  const funcRegex = /(?:local\s+function\s+(\w+)|local\s+(\w+)\s*=\s*function\s*\(?|function\s+(\w+(?:\.\w+)?(?::\w+)?))\s*\(?/g;
  let match;

  while ((match = funcRegex.exec(source)) !== null) {
    const name = match[1] || match[2] || match[3] || '<anonymous>';
    const startLine = source.slice(0, match.index).split('\n').length;

    // Find the end of the function by counting end keywords
    const endLine = findFunctionEnd(lines, startLine - 1);

    functions.push({
      name,
      startLine,
      endLine,
      sourceLines: lines.slice(startLine - 1, endLine),
    });
  }

  // Also detect taskSpawn(function() — anonymous loops
  const taskSpawnRegex = /taskSpawn\s*\(\s*function\s*\(?/g;
  while ((match = taskSpawnRegex.exec(source)) !== null) {
    const startLine = source.slice(0, match.index).split('\n').length;
    const endLine = findFunctionEnd(lines, startLine - 1);
    const loopName = inferLoopName(lines, startLine - 1);

    functions.push({
      name: loopName,
      startLine,
      endLine,
      sourceLines: lines.slice(startLine - 1, endLine),
      isLoop: true,
    });
  }

  return functions;
}

function findFunctionEnd(lines, startIdx) {
  let depth = 0;
  let foundFirst = false;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip comments and strings
    if (line.startsWith('--') || line.startsWith('[[')) continue;

    // Count opening constructs
    const opens = (line.match(/\b(if|then|else|elseif|for|while|do|function|repeat)\b/g) || []).length;
    const closes = (line.match(/\bend\b/g) || []).length;

    // Handle multi-line constructs
    if (/\bthen\b/.test(line) && !/\belseif\b/.test(line)) {
      depth += 1;
    }
    if (/\bdo\b/.test(line) && !/\bthen\b/.test(line)) {
      // Check it's not a function declaration line
      if (!/function/.test(line) || line.startsWith('local function')) {
        // Already counted by function keyword
      }
    }
    if (/\b(function|for|while|repeat)\b/.test(line)) {
      depth += 1;
    }

    depth -= closes;

    if (depth <= 0 && foundFirst) {
      return i + 1;
    }
    if (opens > 0 || closes > 0) {
      foundFirst = true;
    }
  }

  return lines.length;
}

function inferLoopName(lines, startIdx) {
  // Look backwards for context about what this loop does
  for (let i = startIdx; i >= Math.max(0, startIdx - 20); i--) {
    const line = lines[i];
    if (/StopLoop|StartLoop/.test(line)) {
      const nameMatch = line.match(/["'](\w+)["']/);
      if (nameMatch) return `Loop:${nameMatch[1]}`;
    }
    if (/Toggle.*Title/.test(line)) {
      const nameMatch = line.match(/Title\s*=\s*["']([^"']+)["']/);
      if (nameMatch) return `Loop:${nameMatch[1]}`;
    }
  }
  return `Loop:${startIdx}`;
}

function analyzeFunction(fn, source, lines) {
  const funcSource = fn.sourceLines.join('\n');
  let complexity = 1; // Base complexity
  let branches = 0;
  let maxNesting = 0;
  let currentNesting = 0;

  // Count branches
  const branchPatterns = [
    /\bif\b/g,
    /\belseif\b/g,
    /\band\b/g,
    /\bor\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\brepeat\b/g,
    /\?\s*\S+\s*:/g, // ternary-like
  ];

  for (const pattern of branchPatterns) {
    const matches = funcSource.match(pattern) || [];
    branches += matches.length;
    complexity += matches.length;
  }

  // Calculate nesting depth
  for (const line of fn.sourceLines) {
    const trimmed = line.trim();
    if (/^\s*(if|for|while|function)\b/.test(line)) {
      currentNesting++;
      if (currentNesting > maxNesting) maxNesting = currentNesting;
    }
    if (/^\s*end\s*(--|$)/.test(line) || /^\s*end\s*$/.test(line)) {
      currentNesting = Math.max(0, currentNesting - 1);
    }
  }

  // Line count
  const lineCount = fn.sourceLines.length;

  // Classification
  let classification;
  if (complexity <= 5) classification = 'Simple';
  else if (complexity <= 10) classification = 'Moderate';
  else if (complexity <= 20) classification = 'Complex';
  else classification = 'Unmaintainable';

  return {
    name: fn.name,
    startLine: fn.startLine,
    endLine: fn.endLine,
    lineCount,
    complexity,
    branches,
    maxNesting,
    classification,
    isLoop: fn.isLoop || false,
  };
}

// ─── Renderer ───

export function renderLuauComplexity(result) {
  if (result.error) {
    return `[LUAU COMPLEXITY] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push(`[LUAU COMPLEXITY] ${result.fileName}`);
  lines.push('─'.repeat(50));
  lines.push(`Total lines:     ${result.totalLines}`);
  lines.push(`Functions:       ${result.functionCount}`);
  lines.push(`Total complexity: ${result.totalComplexity}`);
  lines.push(`Avg complexity:  ${result.avgComplexity}`);
  lines.push(`Max complexity:  ${result.maxComplexity}`);
  lines.push(`Max nesting:     ${result.maxNesting}`);
  lines.push(`Max func lines:  ${result.maxLineCount}`);
  lines.push('');

  lines.push('### Function Breakdown');
  lines.push('');
  lines.push('| # | Function | Lines | Complexity | Branches | Nesting | Class |');
  lines.push('|---|----------|-------|------------|----------|---------|-------|');

  const sorted = [...result.functions].sort((a, b) => b.complexity - a.complexity);

  for (let i = 0; i < sorted.length; i++) {
    const fn = sorted[i];
    const classIcon = {
      Simple: '🟢',
      Moderate: '🟡',
      Complex: '🟠',
      Unmaintainable: '🔴',
    }[fn.classification] || '?';

    const loopTag = fn.isLoop ? ' [LOOP]' : '';
    lines.push(`| ${i + 1} | ${fn.name}${loopTag} | ${fn.lineCount} | ${fn.complexity} | ${fn.branches} | ${fn.maxNesting} | ${classIcon} ${fn.classification} |`);
  }

  lines.push('');
  lines.push('─'.repeat(50));
  lines.push(`Summary:`);
  lines.push(`  Simple:          ${result.classificationCounts.simple}`);
  lines.push(`  Moderate:        ${result.classificationCounts.moderate}`);
  lines.push(`  Complex:         ${result.classificationCounts.complex}`);
  lines.push(`  Unmaintainable:  ${result.classificationCounts.unmaintainable}`);
  lines.push('');

  // Overall file classification
  let fileClass;
  if (result.avgComplexity <= 5) fileClass = 'Simple';
  else if (result.avgComplexity <= 10) fileClass = 'Moderate';
  else if (result.avgComplexity <= 20) fileClass = 'Complex';
  else fileClass = 'Unmaintainable';

  lines.push(`File classification: ${fileClass}`);
  lines.push('─'.repeat(50));

  return lines.join('\n');
}
