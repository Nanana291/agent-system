#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ──────────────────────────────────────────────
// Luau Regression Gate — Implementation
// ──────────────────────────────────────────────

export function runLuauRegressionGate(filePath, baselinePath, workspace) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return {
      fileName: path.basename(filePath),
      error: `File not found: ${absPath}`,
      verdict: 'BLOCKED',
    };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const checks = {};

  // 1. Risk Score (heuristic estimation)
  checks.riskScore = calcRiskScore(source);

  // 2. Remote Safety
  checks.remoteSafety = calcRemoteSafety(source);

  // 3. Loop Safety
  checks.loopSafety = calcLoopSafety(source);

  // 4. Character Lifecycle
  checks.characterLifecycle = calcCharacterLifecycle(source);

  // 5. Library Loading
  checks.libraryLoading = calcLibraryLoading(source);

  // 6. Feature Parity (baseline comparison)
  checks.featureParity = baselinePath
    ? calcFeatureParity(source, baselinePath)
    : { status: 'N/A', detail: 'No baseline provided' };

  // 7. Thread Management
  checks.threadManagement = calcThreadManagement(source);

  // 8. Local Pressure
  checks.localPressure = calcLocalPressure(source);

  // 9. Original Integrity (baseline comparison)
  checks.originalIntegrity = baselinePath
    ? calcOriginalIntegrity(baselinePath)
    : { status: 'N/A', detail: 'No baseline provided' };

  // Determine verdict
  const blockChecks = Object.entries(checks).filter(([, v]) => v.status === 'BLOCK');
  const warnChecks = Object.entries(checks).filter(([, v]) => v.status === 'WARN');

  let verdict;
  if (blockChecks.length > 0) {
    verdict = 'BLOCKED';
  } else if (warnChecks.length > 0) {
    verdict = 'CONDITIONAL';
  } else {
    verdict = 'READY';
  }

  return {
    fileName: path.basename(filePath),
    filePath: absPath,
    checks,
    blockChecks,
    warnChecks,
    verdict,
  };
}

// ─── Check Implementations ───

function calcRiskScore(source) {
  let score = 0;
  const lines = source.split('\n');

  // Unprotected remotes (+5 each)
  const remoteCalls = extractRemoteCalls(source);
  for (const call of remoteCalls) {
    if (!call.pcallWrapped) score += 5;
  }

  // Unbounded loops (+10 each)
  const whileRegex = /while\s+(true|task\.wait\(\))\s+do/g;
  let match;
  while ((match = whileRegex.exec(source)) !== null) {
    score += 10;
  }

  // Missing pcall (+3 each for FireServer/InvokeServer not in pcall)
  const fireRegex = /:(FireServer|InvokeServer|FireClient|FireAllClients|InvokeClient)\s*\(/g;
  while ((match = fireRegex.exec(source)) !== null) {
    const context = getContextAround(source, match.index, 80);
    if (!context.includes('pcall')) score += 3;
  }

  // Stale character refs (+5 each)
  if (source.includes('HumanoidRootPart') && !source.includes('CharacterAdded')) {
    score += 5;
  }

  // Normalize to 0-100
  score = Math.min(100, Math.max(0, score));

  let status;
  if (score <= 30) status = 'PASS';
  else if (score <= 50) status = 'WARN';
  else status = 'BLOCK';

  return {
    status,
    score,
    detail: `Risk score: ${score}/100`,
  };
}

function calcRemoteSafety(source) {
  const remoteCalls = extractRemoteCalls(source);
  if (remoteCalls.length === 0) {
    return { status: 'PASS', protected: 0, total: 0, detail: 'No remote calls found' };
  }

  let protectedCount = 0;
  for (const call of remoteCalls) {
    if (call.pcallWrapped) protectedCount++;
  }

  const unprotected = remoteCalls.filter((c) => !c.pcallWrapped);
  const clientServerUnprotected = unprotected.filter(
    (c) => c.method === 'FireServer' || c.method === 'InvokeServer'
  );

  let status;
  if (protectedCount === remoteCalls.length) {
    status = 'PASS';
  } else if (clientServerUnprotected.length === 0) {
    // Only client→client remotes are unprotected (lower risk)
    status = 'WARN';
  } else {
    status = 'BLOCK';
  }

  return {
    status,
    protected: protectedCount,
    total: remoteCalls.length,
    unprotected,
    detail: `${protectedCount}/${remoteCalls.length} remotes pcall-wrapped`,
  };
}

function calcLoopSafety(source) {
  const lines = source.split('\n');
  let totalLoops = 0;
  let safeLoops = 0;
  const issues = [];

  // Find while loops
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*while\s+/.test(line)) {
      totalLoops++;

      // Check for task.wait
      if (line.includes('task.wait')) {
        // Extract interval
        const intervalMatch = line.match(/task\.wait\(\s*([\d.]+)\s*\)/);
        if (intervalMatch) {
          const interval = parseFloat(intervalMatch[1]);
          if (interval >= 0.1) {
            safeLoops++;
          } else if (interval >= 0.05) {
            issues.push(`Line ${i + 1}: task.wait(${interval}) — interval too low`);
          } else {
            issues.push(`Line ${i + 1}: task.wait(${interval}) — dangerously low`);
          }
        } else {
          safeLoops++;
        }
      } else {
        issues.push(`Line ${i + 1}: No task.wait() in while loop`);
      }
    }
  }

  let status;
  if (totalLoops === 0) {
    status = 'PASS';
  } else if (safeLoops === totalLoops) {
    status = 'PASS';
  } else if (issues.some((i) => i.includes('No task.wait'))) {
    status = 'BLOCK';
  } else {
    status = 'WARN';
  }

  return {
    status,
    safe: safeLoops,
    total: totalLoops,
    issues,
    detail: `${safeLoops}/${totalLoops} loops safe`,
  };
}

function calcCharacterLifecycle(source) {
  if (!source.includes('Character') && !source.includes('HumanoidRootPart')) {
    return { status: 'N/A', detail: 'No character references in script' };
  }

  const hasCharacterAdded = source.includes('CharacterAdded');
  const hasFindFirstChild = source.includes(':FindFirstChild(') && source.includes('HumanoidRootPart');
  const hasCachedOnce = !hasCharacterAdded && source.includes('HumanoidRootPart');

  let status;
  if (hasCharacterAdded && hasFindFirstChild) {
    status = 'PASS';
  } else if (hasCharacterAdded) {
    status = 'WARN';
  } else if (hasCachedOnce) {
    status = 'BLOCK';
  } else {
    status = 'WARN'; // Character referenced but lifecycle unclear
  }

  return {
    status,
    detail: hasCharacterAdded
      ? 'CharacterAdded connection present'
      : 'No CharacterAdded rebind found',
  };
}

function calcLibraryLoading(source) {
  // Check for common library patterns
  const usesLibSixtyTen = source.includes('LibSixtyTen') || source.includes('CreateWindow');
  const usesObsidian = source.includes('loadstring') && source.includes('game:HttpGet');

  if (!usesLibSixtyTen && !usesObsidian) {
    return { status: 'N/A', detail: 'No UI framework detected' };
  }

  const hasPcall = source.includes('pcall');
  const hasFallback = source.includes('raw.githubusercontent.com') ||
    (source.match(/game:HttpGet/g) || []).length >= 2;
  const hasEarlyReturn = source.includes('return') && source.includes('warn') &&
    source.toLowerCase().includes('fail') || source.includes('abort');

  let status;
  if (hasPcall && hasFallback) {
    status = 'PASS';
  } else if (hasPcall) {
    status = 'WARN';
  } else {
    status = 'BLOCK';
  }

  return {
    status,
    detail: hasFallback
      ? 'Library loads with fallback chain'
      : 'No fallback URL chain detected',
  };
}

function calcFeatureParity(source, baselinePath) {
  try {
    if (!fs.existsSync(baselinePath)) {
      return { status: 'WARN', detail: `Baseline file not found: ${baselinePath}` };
    }

    const baselineSource = fs.readFileSync(baselinePath, 'utf8');

    // Count feature sections (BuildToggle, BuildSection, CreateToggle, etc.)
    const countFeatures = (s) => {
      const toggles = (s.match(/BuildToggle|CreateToggle/g) || []).length;
      const sections = (s.match(/BuildSection|CreateSection/g) || []).length;
      return toggles + sections;
    };

    const baselineCount = countFeatures(baselineSource);
    const currentCount = countFeatures(source);

    let status;
    if (currentCount >= baselineCount) {
      status = 'PASS';
    } else if (currentCount >= baselineCount * 0.9) {
      status = 'WARN';
    } else {
      status = 'BLOCK';
    }

    return {
      status,
      baselineFeatures: baselineCount,
      currentFeatures: currentCount,
      detail: `${currentCount}/${baselineCount} features`,
    };
  } catch (err) {
    return { status: 'WARN', detail: `Error reading baseline: ${err.message}` };
  }
}

function calcThreadManagement(source) {
  const hasStartLoop = source.includes('StartLoop') ||
    (source.includes('taskSpawn') && source.includes('while'));
  const hasStopLoop = source.includes('StopLoop') ||
    source.includes('activeLoop') && source.includes('nil');
  const hasDuplicatePrevention = source.includes('loopId') ||
    source.includes('loop_token') ||
    (source.includes('activeLoop') && source.includes('~=') || source.includes('!='));

  // Count loops
  const loopCount = (source.match(/taskSpawn\s*\(\s*function/g) || []).length;
  const managedLoops = hasStartLoop && hasStopLoop ? loopCount : 0;

  let status;
  if (loopCount === 0) {
    status = 'PASS'; // No loops = no issue
  } else if (hasStartLoop && hasStopLoop && hasDuplicatePrevention) {
    status = 'PASS';
  } else if (hasStartLoop && hasStopLoop) {
    status = 'WARN';
  } else {
    status = 'BLOCK';
  }

  return {
    status,
    managed: managedLoops,
    total: loopCount,
    detail: hasStartLoop && hasStopLoop
      ? `${managedLoops}/${loopCount} loops with lifecycle management`
      : 'No StartLoop/StopLoop pattern found',
  };
}

function calcLocalPressure(source) {
  const lines = source.split('\n');
  let declLineCount = 0;

  for (const line of lines) {
    if (/^\s*local\s+/.test(line)) {
      declLineCount++;
    }
  }

  let status;
  if (declLineCount < 10) {
    status = 'PASS';
  } else if (declLineCount <= 20) {
    status = 'WARN';
  } else {
    status = 'BLOCK';
  }

  return {
    status,
    declLines: declLineCount,
    detail: `${declLineCount} local declaration lines`,
  };
}

function calcOriginalIntegrity(baselinePath) {
  try {
    if (!fs.existsSync(baselinePath)) {
      return { status: 'WARN', detail: `Baseline file not found: ${baselinePath}` };
    }

    const source = fs.readFileSync(baselinePath, 'utf8');
    const hash = crypto.createHash('md5').update(source).digest('hex');

    return {
      status: 'PASS',
      md5: hash,
      detail: `Original checksum: ${hash}`,
    };
  } catch (err) {
    return { status: 'BLOCK', detail: `Error reading baseline: ${err.message}` };
  }
}

// ─── Helpers ───

function extractRemoteCalls(source) {
  const calls = [];
  const regex = /(\w+)\s*:\s*(FireServer|InvokeServer|FireClient|FireAllClients|InvokeClient)\s*\(/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const context = getContextAround(source, match.index, 120);
    const pcallWrapped = context.includes('pcall') || context.includes('pcallRef');

    calls.push({
      remote: match[1],
      method: match[2],
      line: getLineNumber(source, match.index),
      pcallWrapped,
    });
  }

  return calls;
}

function getContextAround(source, index, range) {
  const start = Math.max(0, index - range);
  const end = Math.min(source.length, index + range);
  return source.slice(start, end);
}

function getLineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

// ─── Renderer ───

export function renderLuauRegressionGate(result) {
  if (result.error) {
    return `[LUAU REGRESSION GATE] ERROR\n${result.error}`;
  }

  const pad = (label) => label.padEnd(16);

  let lines = [];
  lines.push(`[LUAU REGRESSION GATE] ${result.fileName}`);
  lines.push('─'.repeat(50));

  const checks = result.checks;

  lines.push(`${pad('Risk score:')}     ${statusLabel(checks.riskScore)}  (${checks.riskScore.score}/100)`);
  lines.push(`${pad('Remote safety:')}  ${statusLabel(checks.remoteSafety)}  (${checks.remoteSafety.protected}/${checks.remoteSafety.total} remotes)`);
  lines.push(`${pad('Loop safety:')}    ${statusLabel(checks.loopSafety)}  (${checks.loopSafety.safe}/${checks.loopSafety.total} loops)`);
  lines.push(`${pad('Character life:')}${statusLabel(checks.characterLifecycle)}`);
  lines.push(`${pad('Library loading:')}${statusLabel(checks.libraryLoading)}`);
  lines.push(`${pad('Feature parity:')} ${statusLabel(checks.featureParity)}  ${checks.featureParity.detail || ''}`);
  lines.push(`${pad('Thread mgmt:')}    ${statusLabel(checks.threadManagement)}  (${checks.threadManagement.managed}/${checks.threadManagement.total} loops)`);
  lines.push(`${pad('Local pressure:')} ${statusLabel(checks.localPressure)}  (${checks.localPressure.declLines} decl lines)`);
  lines.push(`${pad('Orig integrity:')}${statusLabel(checks.originalIntegrity)}  ${checks.originalIntegrity.detail || ''}`);
  lines.push('');
  lines.push('─'.repeat(50));

  if (result.blockChecks.length > 0) {
    lines.push(`BLOCK checks: ${result.blockChecks.map(([k, v]) => k + ' (' + (v.detail || 'no detail') + ')').join(', ')}`);
  } else {
    lines.push('BLOCK checks: none');
  }

  if (result.warnChecks.length > 0) {
    lines.push(`WARN checks:  ${result.warnChecks.map(([k, v]) => k + ' (' + (v.detail || 'no detail') + ')').join(', ')}`);
  } else {
    lines.push('WARN checks:  none');
  }

  lines.push('');
  lines.push(`Verdict: ${result.verdict}`);
  lines.push('─'.repeat(50));

  return lines.join('\n');
}

function statusLabel(check) {
  const s = check.status === 'N/A' ? 'N/A' : check.status;
  return s;
}
