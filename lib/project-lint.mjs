#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Project Lint — Full Repository Health Check
// ──────────────────────────────────────────────
// Goes beyond validate — checks manifest
// consistency, brain health, training staleness,
// upgrade drift, memory conflicts, metric gaps.

export function runProjectLint(workspace) {
  const findings = [];

  // 1. Manifest consistency
  findings.push(...checkManifest(workspace));

  // 2. Profile consistency
  findings.push(...checkProfile(workspace));

  // 3. Brain health
  findings.push(...checkBrain(workspace));

  // 4. Memory state
  findings.push(...checkMemory(workspace));

  // 5. Training state
  findings.push(...checkTraining(workspace));

  // 6. Upgrade drift
  findings.push(...checkUpgradeDrift(workspace));

  // 7. Metrics trail
  findings.push(...checkMetrics(workspace));

  // 8. Change state
  findings.push(...checkChange(workspace));

  // 9. Doc coverage
  findings.push(...checkDocs(workspace));

  // Score
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = findings.filter(f => f.severity === 'HIGH').length;
  const mediumCount = findings.filter(f => f.severity === 'MEDIUM').length;
  const lowCount = findings.filter(f => f.severity === 'LOW').length;

  const score = Math.max(0, 100 - criticalCount * 25 - highCount * 10 - mediumCount * 3 - lowCount * 1);

  let verdict;
  if (criticalCount > 0) verdict = 'FAIL';
  else if (highCount > 2) verdict = 'DEGRADED';
  else if (highCount > 0 || mediumCount > 5) verdict = 'WARN';
  else verdict = 'HEALTHY';

  return {
    timestamp: new Date().toISOString(),
    host: workspace.activeHostName,
    profile: workspace.activeProfileName,
    findings,
    severityCounts: { critical: criticalCount, high: highCount, medium: mediumCount, low: lowCount },
    score,
    verdict,
    byCategory: categorize(findings),
  };
}

// ─── Checks ───

function checkManifest(workspace) {
  const findings = [];

  // Check manifest exists and is valid JSON
  if (!fs.existsSync(workspace.manifestPath)) {
    findings.push({ severity: 'CRITICAL', category: 'manifest', detail: 'agent-system.json missing' });
    return findings;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(workspace.manifestPath, 'utf8'));

    // Version consistency with package.json
    const pkgPath = path.join(workspace.repoRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (manifest.version !== pkg.version) {
        findings.push({
          severity: 'HIGH',
          category: 'manifest',
          detail: `Version mismatch: agent-system.json=${manifest.version}, package.json=${pkg.version}`,
        });
      }
    }

    // Required paths exist
    const requiredPaths = manifest.paths || {};
    for (const [key, relPath] of Object.entries(requiredPaths)) {
      const absPath = path.join(workspace.repoRoot, relPath);
      if (!fs.existsSync(absPath)) {
        findings.push({ severity: 'MEDIUM', category: 'manifest', detail: `Path "${key}" missing: ${relPath}` });
      }
    }
  } catch (e) {
    findings.push({ severity: 'CRITICAL', category: 'manifest', detail: `Invalid JSON: ${e.message}` });
  }

  return findings;
}

function checkProfile(workspace) {
  const findings = [];

  if (!fs.existsSync(workspace.profilePath)) {
    findings.push({ severity: 'HIGH', category: 'profile', detail: `Profile "${workspace.activeProfileName}" missing profile.json` });
    return findings;
  }

  if (!fs.existsSync(workspace.profileDocPath)) {
    findings.push({ severity: 'MEDIUM', category: 'profile', detail: `Profile doc missing: profiles/${workspace.activeProfileName}/AGENTS.md` });
  }

  // Check profile has required fields
  try {
    const profile = JSON.parse(fs.readFileSync(workspace.profilePath, 'utf8'));
    if (!profile.routes) findings.push({ severity: 'MEDIUM', category: 'profile', detail: 'Profile has no routes defined' });
    if (!profile.domains) findings.push({ severity: 'LOW', category: 'profile', detail: 'Profile has no domains defined' });
  } catch (e) {
    findings.push({ severity: 'CRITICAL', category: 'profile', detail: `Invalid profile JSON: ${e.message}` });
  }

  return findings;
}

function checkBrain(workspace) {
  const findings = [];
  const currentPath = workspace.brainCurrentPath;

  if (!fs.existsSync(currentPath)) {
    findings.push({ severity: 'MEDIUM', category: 'brain', detail: 'Brain current.json missing' });
    return findings;
  }

  try {
    const entries = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    if (!Array.isArray(entries)) {
      findings.push({ severity: 'HIGH', category: 'brain', detail: 'Brain is not a JSON array' });
      return findings;
    }

    const total = entries.length;
    if (total === 0) {
      findings.push({ severity: 'LOW', category: 'brain', detail: 'Brain is empty — no knowledge captured' });
      return findings;
    }

    // Tag coverage
    const withTags = entries.filter(e => e.tags && e.tags.length > 0).length;
    const tagCoverage = Math.round((withTags / total) * 100);
    if (tagCoverage < 50) {
      findings.push({ severity: 'MEDIUM', category: 'brain', detail: `Low tag coverage: ${tagCoverage}% (${withTags}/${total})` });
    }

    // Quality distribution
    const lowQuality = entries.filter(e => e.quality === 'low').length;
    if (lowQuality > total * 0.3) {
      findings.push({ severity: 'LOW', category: 'brain', detail: `${lowQuality} low-quality entries (${Math.round(lowQuality / total * 100)}%)` });
    }

    // Evidence coverage
    const withEvidence = entries.filter(e => e.evidence).length;
    const evidenceCoverage = Math.round((withEvidence / total) * 100);
    if (evidenceCoverage < 30) {
      findings.push({ severity: 'MEDIUM', category: 'brain', detail: `Low evidence coverage: ${evidenceCoverage}%` });
    }
  } catch (e) {
    findings.push({ severity: 'HIGH', category: 'brain', detail: `Invalid brain JSON: ${e.message}` });
  }

  return findings;
}

function checkMemory(workspace) {
  const findings = [];

  // Host memory
  if (workspace.hostMemoryPath && !fs.existsSync(workspace.hostMemoryPath)) {
    findings.push({ severity: 'MEDIUM', category: 'memory', detail: `Host memory missing: ${workspace.activeHostName}` });
  } else if (workspace.hostMemoryPath) {
    const content = fs.readFileSync(workspace.hostMemoryPath, 'utf8');
    const ruleCount = content.split('\n').filter(l => /^\d+\./.test(l.trim())).length;
    if (ruleCount === 0) {
      findings.push({ severity: 'LOW', category: 'memory', detail: `Host memory has no numbered rules: ${workspace.activeHostName}` });
    }
  }

  // Pack memory
  if (workspace.packMemoryPath && !fs.existsSync(workspace.packMemoryPath)) {
    findings.push({ severity: 'LOW', category: 'memory', detail: `Pack memory missing: ${workspace.activeHostName}` });
  }

  // Change memory
  if (workspace.changeMemoryPath && fs.existsSync(workspace.changeMemoryPath)) {
    const content = fs.readFileSync(workspace.changeMemoryPath, 'utf8');
    if (content.trim().length < 50) {
      findings.push({ severity: 'LOW', category: 'memory', detail: 'Change memory is nearly empty' });
    }
  }

  return findings;
}

function checkTraining(workspace) {
  const findings = [];
  const currentPath = workspace.trainingCurrentPath;

  if (!fs.existsSync(currentPath)) {
    findings.push({ severity: 'LOW', category: 'training', detail: 'Training not initialized' });
    return findings;
  }

  try {
    const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));

    // Check if training is stale (> 7 days)
    if (current.last_session) {
      const lastDate = new Date(current.last_session);
      const daysAgo = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysAgo > 7) {
        findings.push({ severity: 'LOW', category: 'training', detail: `Last training ${daysAgo} days ago` });
      }
    }
  } catch (e) {
    findings.push({ severity: 'MEDIUM', category: 'training', detail: `Invalid training JSON: ${e.message}` });
  }

  return findings;
}

function checkUpgradeDrift(workspace) {
  const findings = [];
  const currentPath = workspace.upgradeCurrentPath;

  if (!fs.existsSync(currentPath)) {
    findings.push({ severity: 'LOW', category: 'upgrade', detail: 'Upgrade not run yet' });
    return findings;
  }

  try {
    const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));

    // Check if upgrade is stale (> 14 days)
    if (current.last_upgrade) {
      const lastDate = new Date(current.last_upgrade);
      const daysAgo = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysAgo > 14) {
        findings.push({ severity: 'MEDIUM', category: 'upgrade', detail: `Last upgrade ${daysAgo} days ago — possible drift` });
      }
    }
  } catch (e) {
    findings.push({ severity: 'MEDIUM', category: 'upgrade', detail: `Invalid upgrade JSON: ${e.message}` });
  }

  return findings;
}

function checkMetrics(workspace) {
  const findings = [];
  const currentPath = workspace.metricsCurrentPath;

  if (!fs.existsSync(currentPath)) {
    findings.push({ severity: 'LOW', category: 'metrics', detail: 'Metrics not collected yet' });
    return findings;
  }

  try {
    const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    if (current.timestamp) {
      const lastDate = new Date(current.timestamp);
      const daysAgo = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysAgo > 3) {
        findings.push({ severity: 'LOW', category: 'metrics', detail: `Last metrics snapshot ${daysAgo} days ago` });
      }
    }
  } catch (e) {
    findings.push({ severity: 'MEDIUM', category: 'metrics', detail: `Invalid metrics JSON: ${e.message}` });
  }

  return findings;
}

function checkChange(workspace) {
  const findings = [];
  const currentPath = workspace.changeCurrentPath;

  if (fs.existsSync(currentPath)) {
    try {
      const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
      if (current.type && current.status === 'pending') {
        findings.push({ severity: 'MEDIUM', category: 'change', detail: `Stale change: ${current.type} → ${current.target || 'unknown'}` });
      }
    } catch (e) {
      findings.push({ severity: 'MEDIUM', category: 'change', detail: `Invalid change JSON: ${e.message}` });
    }
  }

  return findings;
}

function checkDocs(workspace) {
  const findings = [];

  const requiredDocs = [
    { key: 'README.md', path: path.join(workspace.repoRoot, 'README.md') },
    { key: 'AGENTS.md', path: path.join(workspace.repoRoot, 'AGENTS.md') },
  ];

  for (const doc of requiredDocs) {
    if (!fs.existsSync(doc.path)) {
      findings.push({ severity: 'HIGH', category: 'docs', detail: `${doc.key} missing` });
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

export function renderProjectLint(result) {
  const lines = [];
  lines.push('[PROJECT LINT]');
  lines.push(`Host: ${result.host} | Profile: ${result.profile} | ${result.timestamp}`);
  lines.push('═'.repeat(52));
  lines.push('');

  const healthBar = '█'.repeat(Math.round(result.score / 2)) + '░'.repeat(50 - Math.round(result.score / 2));
  const healthIcon = result.score >= 80 ? '✅' : result.score >= 50 ? '⚠️' : '🔴';
  lines.push(`  Health Score:    [${healthBar}] ${result.score}/100 ${healthIcon}`);
  lines.push(`  Verdict:         ${result.verdict}`);
  lines.push(`  Findings:        ${result.findings.length} total`);
  lines.push('');

  // Category summary
  if (Object.keys(result.byCategory).length > 0) {
    lines.push('── By Category ───────────────────────────────');
    for (const [cat, info] of Object.entries(result.byCategory)) {
      const icon = info.critical > 0 ? '🔴' : info.high > 0 ? '🟠' : '🟢';
      lines.push(`  ${icon} ${cat.padEnd(20)} ${info.count} issues (${info.critical} critical, ${info.high} high)`);
    }
    lines.push('');
  }

  // Findings by severity
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const severityIcon = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' };

  for (const severity of severityOrder) {
    const items = result.findings.filter(f => f.severity === severity);
    if (items.length === 0) continue;

    lines.push(`── ${severity} (${items.length}) ─────────────────────────────`);
    for (const item of items) {
      lines.push(`  ${severityIcon[severity]} [${item.category}] ${item.detail}`);
    }
    lines.push('');
  }

  lines.push('═'.repeat(52));
  lines.push(`  Score: ${result.score}/100 | Verdict: ${result.verdict}`);
  lines.push('═'.repeat(52));

  return lines.join('\n');
}
