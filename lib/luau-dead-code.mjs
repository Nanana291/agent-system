#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau Dead Code — Dead Code Detection
// ──────────────────────────────────────────────

export function runLuauDeadCode(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { fileName: path.basename(filePath), error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');

  const findings = [];

  // 1. Functions never called
  findings.push(...findUncalledFunctions(source, lines));

  // 2. Locals never read
  findings.push(...findUnreadLocals(source, lines));

  // 3. Unreachable code (after return)
  findings.push(...findUnreachableCode(source, lines));

  // 4. Remotes defined but never fired
  findings.push(...findDeadRemotes(source, lines));

  // 5. Empty functions
  findings.push(...findEmptyFunctions(source, lines));

  // 6. Unused parameters
  findings.push(...findUnusedParameters(source, lines));

  // 7. Dead branches (always-true/false conditions)
  findings.push(...findDeadBranches(source, lines));

  // Score
  const totalLines = lines.length;
  const deadCodeLines = countDeadLines(findings);
  const deadPercent = totalLines > 0 ? Math.round((deadCodeLines / totalLines) * 100) : 0;

  let verdict;
  if (deadPercent > 15) verdict = 'HIGH';
  else if (deadPercent > 8) verdict = 'MEDIUM';
  else if (deadPercent > 2) verdict = 'LOW';
  else verdict = 'CLEAN';

  return {
    fileName: path.basename(filePath),
    filePath: absPath,
    totalLines,
    findings,
    deadCodeLines,
    deadPercent,
    verdict,
    byCategory: categorize(findings),
  };
}

// ─── Scanners ───

function findUncalledFunctions(source, lines) {
  const findings = [];
  const functions = new Map();

  // Extract function definitions
  const funcRegex = /(?:local\s+function\s+(\w+)|local\s+(\w+)\s*=\s*function|function\s+(\w+)(?::\w+)?)\s*\(?/g;
  let match;
  while ((match = funcRegex.exec(source)) !== null) {
    const name = match[1] || match[2] || match[3];
    const lineNum = source.slice(0, match.index).split('\n').length;
    if (name && !name.startsWith('_')) { // _prefix conventionally means unused
      functions.set(name, lineNum);
    }
  }

  // Remove from map if called
  for (const [name, lineNum] of functions) {
    // Count occurrences of name( — but not the definition line
    const callRegex = new RegExp(`\\b${name}\\s*\\(`, 'g');
    let count = 0;
    let m;
    while ((m = callRegex.exec(source)) !== null) {
      const callLine = source.slice(0, m.index).split('\n').length;
      if (callLine !== lineNum) count++;
    }

    if (count === 0) {
      findings.push({
        severity: 'MEDIUM',
        category: 'uncalled-function',
        type: 'Uncalled function',
        line: lineNum,
        name,
        detail: `Function "${name}" is defined but never called`,
        suggestion: `Remove or mark with _${name} if intentionally unused`,
      });
    }
  }

  return findings;
}

function findUnreadLocals(source, lines) {
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const localMatch = line.match(/^\s*local\s+(\w+)\s*(?:=\s*(.+))?$/);
    if (!localMatch) continue;

    const varName = localMatch[1];
    const varValue = localMatch[2] || '';

    // Skip _ prefix and constants (UPPER_CASE)
    if (varName.startsWith('_') || /^[A-Z_]+$/.test(varName)) continue;

    // Skip obvious utility patterns
    if (varValue.includes('require(') || varValue.includes('GetService')) continue;

    // Check if read later in file
    const restOfSource = source.slice(source.split('\n').slice(0, i + 1).join('\n').length + 1);
    const readRegex = new RegExp(`\\b${varName}\\b`, 'g');
    const occurrences = restOfSource.match(readRegex);

    if (!occurrences || occurrences.length <= 0) {
      findings.push({
        severity: 'LOW',
        category: 'unread-local',
        type: 'Unread local',
        line: i + 1,
        detail: `Local "${varName}" is declared but never read`,
        suggestion: varValue ? `Remove "${varName}" (assigned but unused)` : `Remove "${varName}" (declared but unused)`,
      });
    }
  }

  return findings;
}

function findUnreachableCode(source, lines) {
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if previous non-empty lines were return
    if (line.startsWith('--') || line === '' || line === 'end') continue;

    // Look backwards for return
    for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
      const prevLine = lines[j].trim();
      if (prevLine === '' || prevLine.startsWith('--')) continue;

      if (/^\s*return\b/.test(prevLine) && !prevLine.includes('function')) {
        if (!/^\s*end\b/.test(line) && !/^\s*else\b/.test(line) && !/^\s*elseif\b/.test(line) && line !== '') {
          findings.push({
            severity: 'HIGH',
            category: 'unreachable',
            type: 'Unreachable code',
            line: i + 1,
            detail: `Code after return statement on line ${j + 1}`,
            suggestion: 'Remove or restructure code',
          });
        }
        break;
      }
      break;
    }
  }

  return findings;
}

function findDeadRemotes(source, lines) {
  const findings = [];

  // Find remote definitions (remote = game.ReplicatedStorage:WaitForChild or similar)
  const remoteDefRegex = /local\s+(\w+)\s*=\s*[\w.:]+(?:WaitForChild|FindFirstChild|WaitForChild)\s*\(\s*["']([^"']+)["']\s*\)/g;
  const remotes = new Map();
  let match;
  while ((match = remoteDefRegex.exec(source)) !== null) {
    remotes.set(match[1], { line: source.slice(0, match.index).split('\n').length, remoteName: match[2] });
  }

  // Check if each remote is used (FireServer, InvokeServer, OnClientEvent:Connect, etc.)
  for (const [name, info] of remotes) {
    const useRegex = new RegExp(`\\b${name}\\s*:\\s*(?:FireServer|InvokeServer|FireClient|FireAllClients|InvokeClient|OnServerEvent|OnClientEvent|OnServerInvoke|OnClientInvoke)`, 'g');
    if (!useRegex.test(source)) {
      findings.push({
        severity: 'MEDIUM',
        category: 'dead-remote',
        type: 'Unused remote',
        line: info.line,
        detail: `Remote "${name}" ("${info.remoteName}") is referenced but never fired/connected`,
        suggestion: `Remove or verify "${info.remoteName}" is still needed`,
      });
    }
  }

  return findings;
}

function findEmptyFunctions(source, lines) {
  const findings = [];

  const funcRegex = /(?:local\s+function\s+(\w+)|local\s+(\w+)\s*=\s*function)\s*\(?/g;
  let match;

  while ((match = funcRegex.exec(source)) !== null) {
    const name = match[1] || match[2] || '<anonymous>';
    const startLine = source.slice(0, match.index).split('\n').length;
    const endLine = findFunctionEnd(lines, startLine - 1);

    const bodyLines = lines.slice(startLine, endLine).filter(l => l.trim() && !l.trim().startsWith('--'));
    if (bodyLines.length === 0) {
      findings.push({
        severity: 'MEDIUM',
        category: 'empty-function',
        type: 'Empty function',
        line: startLine,
        detail: `Function "${name}" has no body`,
        suggestion: 'Remove or add implementation',
      });
    }
  }

  return findings;
}

function findUnusedParameters(source, lines) {
  const findings = [];

  const funcRegex = /(?:local\s+function\s+(\w+)|local\s+(\w+)\s*=\s*function)\s*\(([^)]*)\)/g;
  let match;

  while ((match = funcRegex.exec(source)) !== null) {
    const name = match[1] || match[2] || '<anonymous>';
    const params = match[3]?.split(',').map(p => p.trim()).filter(Boolean) || [];
    const startLine = source.slice(0, match.index).split('\n').length;
    const endLine = findFunctionEnd(lines, startLine - 1);
    const body = lines.slice(startLine, endLine).join('\n');

    for (const param of params) {
      const cleanParam = param.replace(/\.\.\./, '');
      if (cleanParam.startsWith('_')) continue; // _ conventionally unused

      const paramRegex = new RegExp(`\\b${cleanParam}\\b`, 'g');
      const occurrences = body.match(paramRegex);
      if (!occurrences || occurrences.length <= 0) {
        findings.push({
          severity: 'LOW',
          category: 'unused-param',
          type: 'Unused parameter',
          line: startLine,
          detail: `Parameter "${cleanParam}" in "${name}" is never used`,
          suggestion: `Rename to "_${cleanParam}" or remove`,
        });
      }
    }
  }

  return findings;
}

function findDeadBranches(source, lines) {
  const findings = [];

  // Always-false: if false then / if nil then
  const falsePatterns = [
    /\bif\s+false\s+then\b/gi,
    /\bif\s+nil\s+then\b/gi,
  ];

  for (const pattern of falsePatterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      findings.push({
        severity: 'LOW',
        category: 'dead-branch',
        type: 'Dead branch',
        line: source.slice(0, match.index).split('\n').length,
        detail: 'Branch with always-false condition',
        suggestion: 'Remove dead branch',
      });
    }
  }

  return findings;
}

// ─── Helpers ───

function findFunctionEnd(lines, startIdx) {
  let depth = 0;
  let started = false;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*--/.test(line)) continue;
    const opens = (line.match(/\b(if|then|else|elseif|for|while|do|function|repeat)\b/g) || []).length;
    const closes = (line.match(/^\s*end\b/g) || []).length;
    if (/\b(function|if|for|while|repeat)\b/.test(line)) depth++;
    if (/\bthen\b/.test(line) && !/\belseif\b/.test(line)) { /* already counted */ }
    depth -= closes;
    if (depth <= 0 && started) return i + 1;
    if (opens > 0 || closes > 0) started = true;
  }
  return lines.length;
}

function countDeadLines(findings) {
  // Estimate dead lines: uncalled functions + empty functions
  let count = 0;
  for (const f of findings) {
    if (f.type === 'Uncalled function') count += 10; // estimate
    else if (f.type === 'Empty function') count += 1;
    else count += 1;
  }
  return count;
}

function categorize(findings) {
  const cats = {};
  for (const f of findings) {
    const cat = f.category || 'other';
    if (!cats[cat]) cats[cat] = 0;
    cats[cat]++;
  }
  return cats;
}

// ─── Renderer ───

export function renderLuauDeadCode(result) {
  if (result.error) {
    return `[LUAU DEAD CODE] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push(`[LUAU DEAD CODE] ${result.fileName}`);
  lines.push('═'.repeat(52));
  lines.push(`  Total lines:       ${result.totalLines}`);
  lines.push(`  Dead code lines:   ~${result.deadCodeLines} (~${result.deadPercent}%)`);
  lines.push(`  Findings:          ${result.findings.length}`);
  lines.push('');

  const severityIcon = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' };
  const sorted = [...result.findings].sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (order[a.severity] || 3) - (order[b.severity] || 3);
  });

  if (sorted.length > 0) {
    lines.push('── Findings ──────────────────────────────────────');
    for (const f of sorted) {
      const icon = severityIcon[f.severity] || '?';
      lines.push(`  ${icon} [${f.severity}] ${f.type} (L${f.line})`);
      lines.push(`     ${f.detail}`);
      if (f.suggestion) lines.push(`     → ${f.suggestion}`);
      lines.push('');
    }
  }

  if (Object.keys(result.byCategory).length > 0) {
    lines.push('── By Category ───────────────────────────────────');
    for (const [cat, count] of Object.entries(result.byCategory)) {
      lines.push(`  ${cat}: ${count}`);
    }
    lines.push('');
  }

  lines.push('═'.repeat(52));
  lines.push(`  Verdict: ${result.verdict} (${result.deadPercent}% dead code)`);
  lines.push('═'.repeat(52));

  return lines.join('\n');
}
