#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau Verify Features — Feature Parity Checker
// ──────────────────────────────────────────────

export function runLuauVerifyFeatures(sourcePath, baselinePath) {
  const absSource = path.resolve(sourcePath);
  const absBaseline = baselinePath ? path.resolve(baselinePath) : null;

  if (!fs.existsSync(absSource)) {
    return { error: `Source file not found: ${absSource}` };
  }
  if (absBaseline && !fs.existsSync(absBaseline)) {
    return { error: `Baseline file not found: ${absBaseline}` };
  }

  const source = fs.readFileSync(absSource, 'utf8');
  const baseline = absBaseline ? fs.readFileSync(absBaseline, 'utf8') : null;

  const sourceFeatures = extractFeatureSet(source);
  const baselineFeatures = baseline ? extractFeatureSet(baseline) : null;

  // Verify each baseline feature exists in source
  const verification = baseline
    ? verifyParity(baselineFeatures, sourceFeatures, source)
    : verifySelfContained(sourceFeatures, source);

  return {
    sourceFile: path.basename(absSource),
    baselineFile: baseline ? path.basename(absBaseline) : null,
    sourceFeatures,
    baselineFeatures,
    verification,
  };
}

// ─── Feature Extraction ───

function extractFeatureSet(source) {
  const features = [];

  // Toggles: BuildToggle({ Title = "Auto Block" }) or CreateToggle({ Name = "Auto Block" })
  const togglePatterns = [
    { regex: /BuildToggle\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'toggle', nameGroup: 1 },
    { regex: /CreateToggle\s*\(\s*\{[^}]*Name\s*=\s*["']([^"']+)["']/gi, type: 'toggle', nameGroup: 1 },
    { regex: /Toggle\s*\(\s*["']([^"']+)["']/gi, type: 'toggle', nameGroup: 1 },
  ];

  // Dropdowns
  const dropdownPatterns = [
    { regex: /BuildDropdown\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'dropdown', nameGroup: 1 },
    { regex: /CreateDropdown\s*\(\s*\{[^}]*Name\s*=\s*["']([^"']+)["']/gi, type: 'dropdown', nameGroup: 1 },
  ];

  // Sliders
  const sliderPatterns = [
    { regex: /BuildSlider\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'slider', nameGroup: 1 },
    { regex: /CreateSlider\s*\(\s*\{[^}]*Name\s*=\s*["']([^"']+)["']/gi, type: 'slider', nameGroup: 1 },
  ];

  // Buttons
  const buttonPatterns = [
    { regex: /BuildButton\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'button', nameGroup: 1 },
  ];

  // Sections (organizational, not features per se)
  const sectionPatterns = [
    { regex: /BuildSection\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/gi, type: 'section', nameGroup: 1 },
    { regex: /CreateSection\s*\(\s*["']([^"']+)["']/gi, type: 'section', nameGroup: 1 },
  ];

  // Tabs
  const tabPatterns = [
    { regex: /AddTab\s*\(\s*["']([^"']+)["']/gi, type: 'tab', nameGroup: 1 },
  ];

  // Loop-based features (taskSpawn loops that aren't UI-tied)
  const loopPatterns = [
    { regex: /taskSpawn\s*\(\s*function\s*\(\)/gi, type: 'loop' },
  ];

  const allPatterns = [
    ...togglePatterns,
    ...dropdownPatterns,
    ...sliderPatterns,
    ...buttonPatterns,
    ...sectionPatterns,
    ...tabPatterns,
  ];

  for (const pattern of allPatterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match;
    while ((match = regex.exec(source)) !== null) {
      const name = match[pattern.nameGroup] || `anonymous_${features.length}`;
      features.push({
        type: pattern.type,
        name,
        line: source.slice(0, match.index).split('\n').length,
      });
    }
  }

  // Detect loop-based features
  const loopRegex2 = /taskSpawn\s*\(\s*function/g;
  let match;
  while ((match = loopRegex2.exec(source)) !== null) {
    const line = source.slice(0, match.index).split('\n').length;
    const context = getContextAround(source, match.index, 300);
    const name = inferFeatureName(context, source, line - 1);
    features.push({ type: 'loop', name, line });
  }

  return features;
}

function inferFeatureName(context, source, lineIdx) {
  const lines = source.split('\n');

  // Look backwards for toggle title or feature name
  for (let i = lineIdx; i >= Math.max(0, lineIdx - 30); i--) {
    // BuildToggle({ Title = "..." })
    const titleMatch = lines[i].match(/Title\s*=\s*["']([^"']+)["']/);
    if (titleMatch) return titleMatch[1];

    // Name = "..."
    const nameMatch = lines[i].match(/Name\s*=\s*["']([^"']+)["']/);
    if (nameMatch) return nameMatch[1];

    // Section title
    const sectionMatch = lines[i].match(/["'](Auto\s+\w+)["']/i);
    if (sectionMatch) return sectionMatch[1];
  }

  // Look for variable names that hint at feature
  for (let i = lineIdx; i >= Math.max(0, lineIdx - 50); i++) {
    const varMatch = lines[i].match(/local\s+(\w*(?:auto|Auto|block|Block|farm|Farm|kill|Kill|teleport|Teleport)\w*)\s*=/i);
    if (varMatch) return varMatch[1];
  }

  return `loop:${lineIdx}`;
}

// ─── Verification ───

function verifyParity(baselineFeatures, sourceFeatures, sourceSource) {
  const baselineNames = new Set();
  const baselineMap = new Map();

  for (const f of baselineFeatures) {
    if (f.type === 'section' || f.type === 'tab') continue; // Organizational, not features
    const key = normalizeName(f.name);
    baselineNames.add(key);
    baselineMap.set(key, f);
  }

  const sourceNames = new Set();
  for (const f of sourceFeatures) {
    if (f.type === 'section' || f.type === 'tab') continue;
    sourceNames.add(normalizeName(f.name));
  }

  // Check each baseline feature
  const results = [];
  for (const [key, baselineFeature] of baselineMap) {
    const found = sourceNames.has(key);
    const logicPath = found ? verifyLogicPath(sourceSource, key) : null;

    results.push({
      name: baselineFeature.name,
      type: baselineFeature.type,
      baselineLine: baselineFeature.line,
      found,
      sourceLine: found ? sourceFeatures.find(f => normalizeName(f.name) === key)?.line : null,
      logicPath,
    });
  }

  const present = results.filter(r => r.found);
  const missing = results.filter(r => !r.found);
  const withLogic = present.filter(r => r.logicPath && r.logicPath.complete);
  const withoutLogic = present.filter(r => r.logicPath && !r.logicPath.complete);

  // Check for new features in source not in baseline
  const newFeatures = [];
  for (const f of sourceFeatures) {
    if (f.type === 'section' || f.type === 'tab') continue;
    if (!baselineNames.has(normalizeName(f.name))) {
      newFeatures.push(f);
    }
  }

  const totalBaseline = results.length;
  const presentCount = present.length;
  const missingCount = missing.length;

  // Verdict
  let verdict;
  if (missingCount === 0 && withoutLogic.length === 0) verdict = 'PASS';
  else if (missingCount === 0) verdict = 'REVIEW'; // All present but some lack logic path
  else if (missingCount <= Math.ceil(totalBaseline * 0.1)) verdict = 'REVIEW';
  else verdict = 'FAIL';

  return {
    results,
    present: presentCount,
    missing: missingCount,
    total: totalBaseline,
    withFullLogic: withLogic.length,
    withoutLogic: withoutLogic.length,
    newFeatures,
    verdict,
    missingFeatures: missing.map(m => m.name),
  };
}

function verifySelfContained(sourceFeatures, source) {
  // For scripts without baseline: just enumerate features and verify logic paths
  const results = [];
  for (const f of sourceFeatures) {
    if (f.type === 'section' || f.type === 'tab') continue;
    const logicPath = verifyLogicPath(source, normalizeName(f.name));
    results.push({
      name: f.name,
      type: f.type,
      sourceLine: f.line,
      found: true,
      logicPath,
    });
  }

  return {
    results,
    present: results.length,
    missing: 0,
    total: results.length,
    withFullLogic: results.filter(r => r.logicPath?.complete).length,
    withoutLogic: results.filter(r => r.logicPath && !r.logicPath.complete).length,
    newFeatures: [],
    verdict: results.every(r => r.logicPath?.complete) ? 'PASS' : 'REVIEW',
    missingFeatures: [],
  };
}

// ─── Logic Path Verification ───

function verifyLogicPath(source, featureName) {
  const lower = featureName.toLowerCase();
  const keywords = extractKeywords(lower);

  // Check 1: Toggle exists
  const hasToggle = hasToggleFor(source, keywords);

  // Check 2: Loop or callback exists
  const hasLoop = hasLoopFor(source, keywords);
  const hasCallback = hasCallbackFor(source, keywords);

  // Check 3: Remote call exists
  const hasRemote = hasRemoteFor(source, keywords);

  // Check 4: pcall wrapper (if FireServer)
  const hasPcall = hasPcallFor(source, keywords);

  const complete = hasToggle && (hasLoop || hasCallback) && hasRemote;

  return {
    toggle: hasToggle,
    loop: hasLoop,
    callback: hasCallback,
    remote: hasRemote,
    pcall: hasPcall,
    complete,
  };
}

function extractKeywords(featureName) {
  // "Auto Block" → ["auto", "block", "autoblock"]
  const words = featureName.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const combined = words.join('');
  return [...words, combined];
}

function hasToggleFor(source, keywords) {
  for (const kw of keywords) {
    if (new RegExp(`["']${escapeRegex(kw)}["']`, 'i').test(source)) return true;
  }
  // Broader: any keyword in toggle context
  for (const kw of keywords) {
    if (new RegExp(`(BuildToggle|CreateToggle|Toggle)[^}]*${escapeRegex(kw)}`, 'i').test(source)) return true;
  }
  return false;
}

function hasLoopFor(source, keywords) {
  for (const kw of keywords) {
    if (new RegExp(`taskSpawn[^}]*${escapeRegex(kw)}`, 'i').test(source)) return true;
    if (new RegExp(`while[^}]*${escapeRegex(kw)}`, 'i').test(source)) return true;
  }
  return false;
}

function hasCallbackFor(source, keywords) {
  for (const kw of keywords) {
    if (new RegExp(`Callback[^}]*${escapeRegex(kw)}`, 'i').test(source)) return true;
    if (new RegExp(`Changed[^:]*:${escapeRegex(kw)}`, 'i').test(source)) return true;
  }
  // Generic: any callback near keyword
  for (const kw of keywords) {
    const idx = source.toLowerCase().indexOf(kw);
    if (idx >= 0) {
      const context = source.slice(Math.max(0, idx - 200), idx + 200);
      if (/Callback\s*=/.test(context) || /\.Changed\s*:/.test(context)) return true;
    }
  }
  return false;
}

function hasRemoteFor(source, keywords) {
  for (const kw of keywords) {
    const idx = source.toLowerCase().indexOf(kw);
    if (idx >= 0) {
      const context = source.slice(Math.max(0, idx - 300), idx + 300);
      if (/FireServer|InvokeServer|FireClient/.test(context)) return true;
    }
  }
  // Global check: any remote call in script
  return /FireServer|InvokeServer/.test(source);
}

function hasPcallFor(source, keywords) {
  const fireIdx = source.search(/FireServer|InvokeServer/);
  if (fireIdx < 0) return true; // No server calls = N/A
  const context = source.slice(Math.max(0, fireIdx - 100), fireIdx + 200);
  return /pcall|pcallRef|xpcall/.test(context);
}

// ─── Helpers ───

function normalizeName(name) {
  return name.toLowerCase().replace(/[\s_-]+/g, '').trim();
}

function getContextAround(source, index, range) {
  const start = Math.max(0, index - range);
  const end = Math.min(source.length, index + range);
  return source.slice(start, end);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Renderer ───

export function renderLuauVerifyFeatures(result) {
  if (result.error) {
    return `[LUAU VERIFY FEATURES] ERROR\n${result.error}`;
  }

  const lines = [];
  const v = result.verification;

  lines.push(`[LUAU VERIFY FEATURES] ${result.sourceFile}`);
  if (result.baselineFile) lines.push(`  Baseline: ${result.baselineFile}`);
  lines.push('═'.repeat(52));
  lines.push('');

  lines.push(`  Baseline features:  ${v.total}`);
  lines.push(`  Present:            ${v.present}`);
  lines.push(`  Missing:            ${v.missing}`);
  lines.push(`  Full logic path:    ${v.withFullLogic}`);
  lines.push(`  Partial logic:      ${v.withoutLogic}`);
  if (v.newFeatures.length > 0) {
    lines.push(`  New in source:      ${v.newFeatures.length}`);
  }
  lines.push('');

  // Feature-by-feature
  lines.push('── Feature Verification ─────────────────────────');
  for (const r of v.results) {
    const status = r.found
      ? (r.logicPath?.complete ? '✅' : '⚠️')
      : '❌';

    let detail = '';
    if (r.found && r.logicPath) {
      const parts = [];
      if (r.logicPath.toggle) parts.push('toggle');
      if (r.logicPath.loop) parts.push('loop');
      if (r.logicPath.callback) parts.push('callback');
      if (r.logicPath.remote) parts.push('remote');
      if (!r.logicPath.loop && !r.logicPath.callback) parts.push('no-loop/callback');
      if (r.logicPath.remote && !r.logicPath.pcall) parts.push('no-pcall');
      detail = parts.join(', ');
    }

    const lineInfo = r.sourceLine ? ` L${r.sourceLine}` : r.baselineLine ? ` baseline:L${r.baselineLine}` : '';
    lines.push(`  ${status} ${r.name}${lineInfo} — ${detail}`);
  }

  if (v.missingFeatures.length > 0) {
    lines.push('');
    lines.push('── Missing Features ─────────────────────────────');
    for (const name of v.missingFeatures) {
      lines.push(`  ❌ ${name}`);
    }
  }

  if (v.newFeatures.length > 0) {
    lines.push('');
    lines.push('── New Features (not in baseline) ──────────────');
    for (const f of v.newFeatures) {
      lines.push(`  ➕ ${f.name} (${f.type}, L${f.line})`);
    }
  }

  lines.push('');
  lines.push('═'.repeat(52));
  lines.push(`  Verdict: ${v.verdict}`);
  lines.push('═'.repeat(52));

  return lines.join('\n');
}
