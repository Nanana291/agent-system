#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau Verify Flow — Data Flow Verifier
// ──────────────────────────────────────────────
// Builds def-use chains, verifies function
// signatures, checks remote completeness,
// validates callback connections, detects
// use-before-def and dangling references.

export function runLuauVerifyFlow(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');

  const findings = [];

  // 1. Build def-use chains
  const defUseChains = buildDefUseChains(source, lines);
  findings.push(...findUseBeforeDef(defUseChains, source, lines));
  findings.push(...findDanglingReferences(defUseChains, source, lines));

  // 2. Verify function signatures
  findings.push(...verifyFunctionSignatures(source, lines));

  // 3. Check remote completeness
  findings.push(...verifyRemoteCompleteness(source, lines));

  // 4. Validate callback connections
  findings.push(...verifyCallbackConnections(source, lines));

  // 5. Verify loop integrity
  findings.push(...verifyLoopIntegrity(source, lines));

  // 6. Check character lifecycle
  findings.push(...verifyCharacterLifecycle(source, lines));

  // 7. Verify state table consistency
  findings.push(...verifyStateTableConsistency(source, lines));

  // Score and verdict
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = findings.filter(f => f.severity === 'HIGH').length;
  const mediumCount = findings.filter(f => f.severity === 'MEDIUM').length;
  const lowCount = findings.filter(f => f.severity === 'LOW').length;

  const score = Math.max(0, 100 - criticalCount * 20 - highCount * 10 - mediumCount * 3 - lowCount * 1);

  let verdict;
  if (criticalCount > 0) verdict = 'FAIL';
  else if (highCount > 3) verdict = 'RISKY';
  else if (highCount > 0) verdict = 'WARN';
  else verdict = 'PASS';

  return {
    fileName: path.basename(filePath),
    filePath: absPath,
    totalLines: lines.length,
    findings,
    severityCounts: { critical: criticalCount, high: highCount, medium: mediumCount, low: lowCount },
    score,
    verdict,
    byCategory: categorize(findings),
  };
}

// ─── 1. Build Def-Use Chains ───

function buildDefUseChains(source, lines) {
  const definitions = new Map(); // name → [{line, type}]
  const uses = new Map(); // name → [{line, type, context}]

  // Find all local definitions
  const localRegex = /^\s*local\s+(\w+)(?:\s*=\s*(.+))?$/gm;
  let match;
  while ((match = localRegex.exec(source)) !== null) {
    const name = match[1];
    const line = source.slice(0, match.index).split('\n').length;
    if (!definitions.has(name)) definitions.set(name, []);
    definitions.get(name).push({ line, type: 'local', value: match[2]?.trim() });
  }

  // Find function definitions
  const funcRegex = /(?:local\s+function\s+(\w+)|local\s+(\w+)\s*=\s*function|function\s+(\w+)(?::\w+)?)\s*\(?/g;
  while ((match = funcRegex.exec(source)) !== null) {
    const name = match[1] || match[2] || match[3];
    const line = source.slice(0, match.index).split('\n').length;
    if (!definitions.has(name)) definitions.set(name, []);
    definitions.get(name).push({ line, type: 'function' });
  }

  // Find all variable uses
  for (const [name, defs] of definitions) {
    const useRegex = new RegExp(`\\b${name}\\b`, 'g');
    let um;
    while ((um = useRegex.exec(source)) !== null) {
      const line = source.slice(0, um.index).split('\n').length;

      // Skip definition lines
      const isDef = defs.some(d => d.line === line);
      if (isDef) continue;

      // Determine use type
      const context = source.slice(um.index, um.index + name.length + 10);
      let useType = 'read';
      if (/^\s*=/.test(context.slice(name.length))) useType = 'write';
      else if (/^\s*\[/.test(context.slice(name.length))) useType = 'index';
      else if (/^\s*\(/.test(context.slice(name.length))) useType = 'call';
      else if (/^\s*\./.test(context.slice(name.length))) useType = 'property';

      if (!uses.has(name)) uses.set(name, []);
      uses.get(name).push({ line, type: useType });
    }
  }

  return { definitions, uses };
}

function findUseBeforeDef(defUseChains, source, lines) {
  const findings = [];
  const { definitions, uses } = defUseChains;

  for (const [name, usesList] of uses) {
    const defs = definitions.get(name);
    if (!defs || defs.length === 0) continue;

    const firstDef = defs[0].line;

    for (const use of usesList) {
      if (use.line < firstDef) {
        findings.push({
          severity: 'CRITICAL',
          category: 'def-use',
          type: 'Use before definition',
          line: use.line,
          detail: `"${name}" used at L${use.line} but defined at L${firstDef}`,
          suggestion: `Move definition of "${name}" before L${use.line} or delay use`,
        });
      }
    }
  }

  return findings;
}

function findDanglingReferences(defUseChains, source, lines) {
  const findings = [];
  const { definitions, uses } = defUseChains;

  // Find variables defined but never used (excluding _ prefix and UPPER_CASE)
  for (const [name, defs] of definitions) {
    if (name.startsWith('_')) continue;
    if (/^[A-Z_]+$/.test(name)) continue; // Constants
    if (defs[0]?.type === 'function') continue; // Functions checked separately

    const useList = uses.get(name);
    if (!useList || useList.length === 0) {
      findings.push({
        severity: 'MEDIUM',
        category: 'def-use',
        type: 'Defined but never used',
        line: defs[0].line,
        detail: `"${name}" is defined but never read`,
        suggestion: `Remove "${name}" or prefix with "_" if intentionally unused`,
      });
    }
  }

  return findings;
}

// ─── 2. Verify Function Signatures ───

function verifyFunctionSignatures(source, lines) {
  const findings = [];

  // Extract function definitions with params
  const funcDefs = new Map();
  const funcRegex = /(?:local\s+function\s+(\w+)|local\s+(\w+)\s*=\s*function)\s*\(([^)]*)\)/g;
  let match;
  while ((match = funcRegex.exec(source)) !== null) {
    const name = match[1] || match[2];
    const params = match[3]?.split(',').map(p => p.trim()).filter(Boolean) || [];
    const line = source.slice(0, match.index).split('\n').length;
    funcDefs.set(name, { params, line });
  }

  // Find function calls and verify arg count
  for (const [name, def] of funcDefs) {
    const expectedCount = def.params.length;
    const callRegex = new RegExp(`\\b${name}\\s*\\(([^)]*)\\)`, 'g');
    let cm;
    while ((cm = callRegex.exec(source)) !== null) {
      const callLine = source.slice(0, cm.index).split('\n').length;
      if (callLine === def.line) continue; // Skip definition

      const args = cm[1].split(',').map(a => a.trim()).filter(Boolean);
      const actualCount = args.length;

      // Luau allows fewer args (they become nil), but too many is suspicious
      if (actualCount > expectedCount + 2) {
        findings.push({
          severity: 'HIGH',
          category: 'signature',
          type: 'Excess arguments',
          line: callLine,
          detail: `${name} expects ${expectedCount} args but ${actualCount} provided`,
          suggestion: `Check if "${name}" signature changed or remove excess args`,
        });
      }
    }
  }

  return findings;
}

// ─── 3. Verify Remote Completeness ───

function verifyRemoteCompleteness(source, lines) {
  const findings = [];

  // Find remote definitions
  const remoteDefs = new Map();
  const defRegex = /local\s+(\w+)\s*=\s*([\w.]+)\s*:\s*(WaitForChild|FindFirstChild)\s*\(\s*["']([^"']+)["']\s*\)/g;
  let match;
  while ((match = defRegex.exec(source)) !== null) {
    remoteDefs.set(match[1], {
      varName: match[1],
      parentPath: match[2],
      remoteName: match[4],
      method: match[3],
      line: source.slice(0, match.index).split('\n').length,
    });
  }

  // Check each defined remote is actually used
  for (const [varName, def] of remoteDefs) {
    const fireRegex = new RegExp(`\\b${varName}\\s*:\\s*(FireServer|InvokeServer|FireClient|FireAllClients|InvokeClient)\\s*\\(`, 'g');
    const eventRegex = new RegExp(`\\b${varName}\\s*\\.\\s*(OnServerEvent|OnClientEvent|OnServerInvoke|OnClientInvoke)\\s*:\\s*Connect`, 'g');

    const fireCount = [...source.matchAll(fireRegex)].length;
    const eventCount = [...source.matchAll(eventRegex)].length;

    if (fireCount === 0 && eventCount === 0) {
      findings.push({
        severity: 'MEDIUM',
        category: 'remote',
        type: 'Defined but unused remote',
        line: def.line,
        detail: `Remote "${def.remoteName}" (${varName}) is defined but never fired or connected`,
        suggestion: `Remove "${varName}" or verify it's still needed`,
      });
    }

    // Check for unprotected client→server calls
    const fireCallRegex = new RegExp(`\\b${varName}\\s*:\\s*(FireServer|InvokeServer)\\s*\\(`, 'g');
    let fm;
    while ((fm = fireCallRegex.exec(source)) !== null) {
      const line = source.slice(0, fm.index).split('\n').length;
      const context = source.slice(Math.max(0, fm.index - 100), fm.index + fm[0].length + 100);
      if (!/pcall|pcallRef|xpcall/.test(context.slice(0, 120))) {
        findings.push({
          severity: 'HIGH',
          category: 'remote',
          type: 'Unprotected client→server call',
          line,
          detail: `${varName}:${fm[1]} at L${line} is not pcall-wrapped`,
          suggestion: `Wrap in pcallRef: pcallRef(function() ${fm[0]}... end)`,
        });
      }
    }
  }

  return findings;
}

// ─── 4. Validate Callback Connections ───

function verifyCallbackConnections(source, lines) {
  const findings = [];

  // Check that all Connect calls have a function argument
  const connectRegex = /([\w.]+)\s*:\s*Connect\s*\(([^)]*)\)/g;
  let match;
  while ((match = connectRegex.exec(source)) !== null) {
    const target = match[1];
    const arg = match[2].trim();
    const line = source.slice(0, match.index).split('\n').length;

    if (!arg || arg === '' || arg === 'nil') {
      findings.push({
        severity: 'CRITICAL',
        category: 'callback',
        type: 'Empty callback connection',
        line,
        detail: `${target}:Connect(${arg || 'empty'}) — no handler function`,
        suggestion: `Provide a function: ${target}:Connect(function() ... end)`,
      });
    }

    // Check if connecting to non-existent function name
    if (/^\w+$/.test(arg) && !arg.startsWith('function')) {
      const funcName = arg;
      if (!source.includes(`function ${funcName}`) && !source.includes(`${funcName} = function`)) {
        findings.push({
          severity: 'HIGH',
          category: 'callback',
          type: 'Connection to undefined function',
          line,
          detail: `${target}:Connect(${funcName}) — "${funcName}" is not defined`,
          suggestion: `Define function "${funcName}" before connecting`,
        });
      }
    }
  }

  return findings;
}

// ─── 5. Verify Loop Integrity ───

function verifyLoopIntegrity(source, lines) {
  const findings = [];

  // Find taskSpawn loops
  const loopRegex = /taskSpawn\s*\(\s*function\s*\(\s*\)/g;
  let match;
  while ((match = loopRegex.exec(source)) !== null) {
    const startLine = source.slice(0, match.index).split('\n').length;
    const context = source.slice(match.index, Math.min(source.length, match.index + 1000));

    // Check for while condition
    if (!/while\s+/.test(context)) {
      findings.push({
        severity: 'HIGH',
        category: 'loop',
        type: 'taskSpawn without while loop',
        line: startLine,
        detail: `taskSpawn at L${startLine} has no while loop — runs once then exits`,
        suggestion: `Add while condition: while toggles.autoFarm do`,
      });
    }

    // Check for task.wait
    if (/while\s+/.test(context) && !/task\.wait/.test(context)) {
      findings.push({
        severity: 'CRITICAL',
        category: 'loop',
        type: 'Loop without task.wait',
        line: startLine,
        detail: `Loop at L${startLine} has no task.wait() — will crash executor`,
        suggestion: `Add task.wait() at end of loop body`,
      });
    }

    // Check for character validation
    if (/HumanoidRootPart/.test(source) && !/FindFirstChild.*HumanoidRootPart|HumanoidRootPart\s*and/.test(context)) {
      findings.push({
        severity: 'MEDIUM',
        category: 'loop',
        type: 'Loop without character validation',
        line: startLine,
        detail: `Loop at L${startLine} may run without valid character`,
        suggestion: `Add guard: if not character or not rootPart then task.wait(0.1) continue end`,
      });
    }
  }

  return findings;
}

// ─── 6. Verify Character Lifecycle ───

function verifyCharacterLifecycle(source, lines) {
  const findings = [];

  const hasCharacterAdded = /\.CharacterAdded\s*:\s*Connect/.test(source);
  const hasHumanoidRootPart = /HumanoidRootPart/.test(source);
  const hasFindFirstChild = /:FindFirstChild\s*\(\s*["']HumanoidRootPart["']\s*\)/.test(source);

  if (hasHumanoidRootPart && !hasCharacterAdded) {
    findings.push({
      severity: 'HIGH',
      category: 'lifecycle',
      type: 'No CharacterAdded rebind',
      line: 1,
      detail: 'Script uses HumanoidRootPart but has no CharacterAdded connection for respawn handling',
      suggestion: 'Add: player.CharacterAdded:Connect(function(char) ... end)',
    });
  }

  if (hasHumanoidRootPart && !hasFindFirstChild && !hasCharacterAdded) {
    findings.push({
      severity: 'MEDIUM',
      category: 'lifecycle',
      type: 'Unsafe HumanoidRootPart access',
      line: 1,
      detail: 'HumanoidRootPart accessed without FindFirstChild or WaitForChild',
      suggestion: 'Use: character:FindFirstChild("HumanoidRootPart") with nil check',
    });
  }

  return findings;
}

// ─── 7. Verify State Table Consistency ───

function verifyStateTableConsistency(source, lines) {
  const findings = [];

  // Find state table definitions (Toggles, Options, etc.)
  const stateTables = new Map();
  const stateRegex = /local\s+(Toggles|Options|Config|Settings|State|Defaults|Presets)\s*=\s*\{/g;
  let match;
  while ((match = stateRegex.exec(source)) !== null) {
    const name = match[1];
    const line = source.slice(0, match.index).split('\n').length;
    // Extract keys
    const context = source.slice(match.index, Math.min(source.length, match.index + 2000));
    const keys = [];
    const keyRegex = /\[\s*["']([^"']+)["']\s*\]\s*=/g;
    let km;
    while ((km = keyRegex.exec(context)) !== null) {
      keys.push(km[1]);
    }
    stateTables.set(name, { keys, line });
  }

  // Check if UI controls reference state table keys
  for (const [tableName, table] of stateTables) {
    if (tableName === 'Toggles' || tableName === 'Options') {
      // Find UI controls that reference this table
      const uiRefs = source.match(new RegExp(`${tableName}\\s*\\[\\s*["']([^"']+)["']\\s*\\]`, 'g')) || [];
      const uiKeys = uiRefs.map(r => {
        const km = r.match(/["']([^"']+)["']/);
        return km ? km[1] : null;
      }).filter(Boolean);

      // Check for UI keys not in state table
      for (const key of uiKeys) {
        if (!table.keys.includes(key)) {
          findings.push({
            severity: 'MEDIUM',
            category: 'state',
            type: 'UI key not in state table',
            line: 1, // Approximate — would need precise tracking
            detail: `UI references ${tableName}["${key}"] but key not in ${tableName} definition`,
            suggestion: `Add ["${key}"] = false/nil to ${tableName} table`,
          });
        }
      }
    }
  }

  return findings;
}

// ─── Helpers ───

function categorize(findings) {
  const cats = {};
  for (const f of findings) {
    const cat = f.category || 'other';
    if (!cats[cat]) cats[cat] = { count: 0, critical: 0, high: 0 };
    cats[cat].count++;
    if (f.severity === 'CRITICAL') cats[cat].critical++;
    else if (f.severity === 'HIGH') cats[cat].high++;
  }
  return cats;
}

// ─── Renderer ───

export function renderLuauVerifyFlow(result) {
  if (result.error) {
    return `[LUAU VERIFY FLOW] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push(`[LUAU VERIFY FLOW] ${result.fileName}`);
  lines.push('═'.repeat(52));
  lines.push(`  Total lines:       ${result.totalLines}`);
  lines.push(`  Flow score:        ${result.score}/100`);
  lines.push(`  Findings:          ${result.findings.length}`);
  lines.push('');

  const severityIcon = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' };

  // Critical first
  const sorted = [...result.findings].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (order[a.severity] || 4) - (order[b.severity] || 4);
  });

  for (const f of sorted) {
    const icon = severityIcon[f.severity] || '?';
    lines.push(`  ${icon} [${f.severity}] ${f.type} (L${f.line || '?'})`);
    lines.push(`     ${f.detail}`);
    if (f.suggestion) lines.push(`     → ${f.suggestion}`);
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
