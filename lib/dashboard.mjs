#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Agent System Dashboard — System Health Panel
// ──────────────────────────────────────────────

export function runDashboard(workspace) {
  const sections = {};

  // 1. Manifest status
  sections.manifest = getManifestStatus(workspace);

  // 2. Brain status
  sections.brain = getBrainStatus(workspace);

  // 3. Memory status
  sections.memory = getMemoryStatus(workspace);

  // 4. Training status
  sections.training = getTrainingStatus(workspace);

  // 5. Upgrade status
  sections.upgrade = getUpgradeStatus(workspace);

  // 6. Change status
  sections.change = getChangeStatus(workspace);

  // 7. Metrics status
  sections.metrics = getMetricsStatus(workspace);

  // 8. Profile status
  sections.profile = getProfileStatus(workspace);

  // Overall health
  let healthScore = 0;
  let healthChecks = 0;

  if (sections.manifest.valid) { healthScore += 10; }
  healthChecks += 10;

  if (sections.brain.totalEntries > 0) { healthScore += 10; }
  healthChecks += 10;

  if (sections.brain.healthScore >= 70) { healthScore += 10; }
  else if (sections.brain.healthScore >= 40) { healthScore += 5; }
  healthChecks += 10;

  if (sections.profile.active) { healthScore += 10; }
  healthChecks += 10;

  if (sections.memory.hostExists) { healthScore += 10; }
  healthChecks += 10;

  if (sections.training.hasHistory) { healthScore += 10; }
  else healthScore += 5;
  healthChecks += 10;

  const overallHealth = Math.round((healthScore / healthChecks) * 100);

  return {
    sections,
    overallHealth,
    timestamp: new Date().toISOString(),
    host: workspace.activeHostName,
    profile: workspace.activeProfileName,
  };
}

// ─── Section Getters ───

function getManifestStatus(workspace) {
  return {
    valid: fs.existsSync(workspace.manifestPath),
    version: workspace.manifest.version || 'unknown',
    profile: workspace.activeProfileName,
    host: workspace.activeHostName,
  };
}

function getBrainStatus(workspace) {
  const currentPath = workspace.brainCurrentPath;
  const historyPath = workspace.brainHistoryPath;

  if (!fs.existsSync(currentPath)) {
    return { exists: false, totalEntries: 0, healthScore: 0 };
  }

  try {
    const entries = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    if (!Array.isArray(entries)) return { exists: true, totalEntries: 0, healthScore: 0 };

    const withTags = entries.filter(e => e.tags && e.tags.length > 0).length;
    const withEvidence = entries.filter(e => e.evidence).length;
    const byScope = {};
    for (const e of entries) {
      const s = e.scope || 'unknown';
      byScope[s] = (byScope[s] || 0) + 1;
    }
    const byQuality = {};
    for (const e of entries) {
      const q = e.quality || 'unknown';
      byQuality[q] = (byQuality[q] || 0) + 1;
    }

    const tagRatio = entries.length > 0 ? withTags / entries.length : 0;
    const evidenceRatio = entries.length > 0 ? withEvidence / entries.length : 0;
    const healthScore = Math.round(tagRatio * 50 + evidenceRatio * 50);

    return {
      exists: true,
      totalEntries: entries.length,
      withTags,
      withEvidence,
      byScope,
      byQuality,
      healthScore,
      historyEntries: fs.existsSync(historyPath)
        ? fs.readFileSync(historyPath, 'utf8').trim().split('\n').filter(Boolean).length
        : 0,
    };
  } catch {
    return { exists: false, totalEntries: 0, healthScore: 0, error: 'Invalid brain JSON' };
  }
}

function getMemoryStatus(workspace) {
  const hostPath = workspace.hostMemoryPath;
  const changePath = workspace.changeMemoryPath;
  const packPath = workspace.packMemoryPath;

  return {
    hostExists: fs.existsSync(hostPath),
    hostLines: fs.existsSync(hostPath) ? fs.readFileSync(hostPath, 'utf8').split('\n').filter(l => l.trim()).length : 0,
    changeExists: fs.existsSync(changePath),
    changeLines: fs.existsSync(changePath) ? fs.readFileSync(changePath, 'utf8').split('\n').filter(l => l.trim()).length : 0,
    packExists: fs.existsSync(packPath),
  };
}

function getTrainingStatus(workspace) {
  const currentPath = workspace.trainingCurrentPath;
  const historyPath = workspace.trainingHistoryPath;

  if (!fs.existsSync(currentPath)) {
    return { exists: false, hasHistory: false };
  }

  try {
    const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    return {
      exists: true,
      hasHistory: fs.existsSync(historyPath),
      lastSession: current.last_session || 'unknown',
      totalSessions: current.total_sessions || 0,
      luauFocus: current.luau_focus || false,
    };
  } catch {
    return { exists: false, hasHistory: false };
  }
}

function getUpgradeStatus(workspace) {
  const currentPath = workspace.upgradeCurrentPath;
  const historyPath = workspace.upgradeHistoryPath;

  if (!fs.existsSync(currentPath)) {
    return { exists: false };
  }

  try {
    const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    return {
      exists: true,
      lastUpgrade: current.last_upgrade || 'never',
      agentsUpgraded: current.agents_upgraded || 0,
      historyEntries: fs.existsSync(historyPath)
        ? fs.readFileSync(historyPath, 'utf8').trim().split('\n').filter(Boolean).length
        : 0,
    };
  } catch {
    return { exists: false };
  }
}

function getChangeStatus(workspace) {
  const currentPath = workspace.changeCurrentPath;
  const historyPath = workspace.changeHistoryPath;

  if (!fs.existsSync(currentPath)) {
    return { active: false };
  }

  try {
    const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    return {
      active: !!current.type,
      type: current.type || null,
      target: current.target || null,
      historyEntries: fs.existsSync(historyPath)
        ? fs.readFileSync(historyPath, 'utf8').trim().split('\n').filter(Boolean).length
        : 0,
    };
  } catch {
    return { active: false };
  }
}

function getMetricsStatus(workspace) {
  const currentPath = workspace.metricsCurrentPath;
  const historyPath = workspace.metricsHistoryPath;

  if (!fs.existsSync(currentPath)) {
    return { exists: false };
  }

  try {
    const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    return {
      exists: true,
      lastSnapshot: current.timestamp || 'unknown',
      historyEntries: fs.existsSync(historyPath)
        ? fs.readFileSync(historyPath, 'utf8').trim().split('\n').filter(Boolean).length
        : 0,
    };
  } catch {
    return { exists: false };
  }
}

function getProfileStatus(workspace) {
  return {
    active: fs.existsSync(workspace.profilePath),
    name: workspace.activeProfileName,
    docExists: fs.existsSync(workspace.profileDocPath),
  };
}

// ─── Renderer ───

export function renderDashboard(result) {
  const lines = [];
  const s = result.sections;

  lines.push('[AGENT SYSTEM DASHBOARD]');
  lines.push(`Profile: ${result.profile} | Host: ${result.host} | ${result.timestamp}`);
  lines.push('═'.repeat(52));
  lines.push('');

  // Overall health
  const healthBar = '█'.repeat(Math.round(result.overallHealth / 2)) + '░'.repeat(50 - Math.round(result.overallHealth / 2));
  const healthIcon = result.overallHealth >= 80 ? '✅' : result.overallHealth >= 50 ? '⚠️' : '🔴';
  lines.push(`  Overall Health: [${healthBar}] ${result.overallHealth}% ${healthIcon}`);
  lines.push('');

  // Manifest
  lines.push('── Manifest ──────────────────────────────────────');
  lines.push(`  Version:       ${s.manifest.version}`);
  lines.push(`  Profile:       ${s.manifest.profile}`);
  lines.push(`  Host:          ${s.manifest.host}`);
  lines.push(`  Status:        ${s.manifest.valid ? '✅ Valid' : '❌ Missing'}`);
  lines.push('');

  // Brain
  lines.push('── Brain ─────────────────────────────────────────');
  if (s.brain.exists) {
    lines.push(`  Entries:       ${s.brain.totalEntries}`);
    lines.push(`  With tags:     ${s.brain.withTags || 0}`);
    lines.push(`  With evidence: ${s.brain.withEvidence || 0}`);
    lines.push(`  Health:        ${s.brain.healthScore}/100`);
    lines.push(`  History:       ${s.brain.historyEntries || 0} events`);
    if (s.brain.byQuality) {
      const q = s.brain.byQuality;
      lines.push(`  Quality:       high=${q.high || 0} med=${q.medium || 0} low=${q.low || 0}`);
    }
  } else {
    lines.push(`  Status:        ❌ ${s.brain.error || 'Brain not initialized'}`);
  }
  lines.push('');

  // Memory
  lines.push('── Memory ────────────────────────────────────────');
  if (s.memory.hostExists) {
    lines.push(`  Host memory:   ✅ ${s.memory.hostLines} lines`);
  } else {
    lines.push(`  Host memory:   ❌ Missing`);
  }
  if (s.memory.changeExists) {
    lines.push(`  Change memory: ✅ ${s.memory.changeLines} lines`);
  } else {
    lines.push(`  Change memory: — Empty`);
  }
  if (s.memory.packExists) {
    lines.push(`  Pack memory:   ✅ Present`);
  } else {
    lines.push(`  Pack memory:   ❌ Missing`);
  }
  lines.push('');

  // Training
  lines.push('── Training ──────────────────────────────────────');
  if (s.training.exists) {
    lines.push(`  Sessions:      ${s.training.totalSessions || 0}`);
    lines.push(`  Last:          ${s.training.lastSession || 'unknown'}`);
    lines.push(`  Luau focus:    ${s.training.luauFocus ? '✅' : '—'}`);
  } else {
    lines.push(`  Status:        ❌ Not initialized`);
  }
  lines.push('');

  // Upgrade
  lines.push('── Upgrade ───────────────────────────────────────');
  if (s.upgrade.exists) {
    lines.push(`  Last upgrade:  ${s.upgrade.lastUpgrade || 'unknown'}`);
    lines.push(`  Agents:        ${s.upgrade.agentsUpgraded || 0}`);
    lines.push(`  History:       ${s.upgrade.historyEntries || 0} events`);
  } else {
    lines.push(`  Status:        — Never run`);
  }
  lines.push('');

  // Change
  lines.push('── Change ────────────────────────────────────────');
  if (s.change.active) {
    lines.push(`  Active:        ${s.change.type} → ${s.change.target || '—'}`);
    lines.push(`  History:       ${s.change.historyEntries || 0} events`);
  } else {
    lines.push(`  Status:        — No active change`);
  }
  lines.push('');

  // Metrics
  lines.push('── Metrics ───────────────────────────────────────');
  if (s.metrics.exists) {
    lines.push(`  Last snapshot: ${s.metrics.lastSnapshot}`);
    lines.push(`  History:       ${s.metrics.historyEntries || 0} entries`);
  } else {
    lines.push(`  Status:        — No metrics collected`);
  }
  lines.push('');

  // Profile
  lines.push('── Profile ───────────────────────────────────────');
  if (s.profile.active) {
    lines.push(`  Active:        ${s.profile.name}`);
    lines.push(`  Doc:           ${s.profile.docExists ? '✅ Present' : '❌ Missing'}`);
  } else {
    lines.push(`  Status:        ❌ No active profile`);
  }
  lines.push('');

  lines.push('═'.repeat(52));
  lines.push(`  Health: ${result.overallHealth}% ${result.overallHealth >= 80 ? '✅ Good' : result.overallHealth >= 50 ? '⚠️  Fair' : '🔴 Poor'}`);
  lines.push('═'.repeat(52));

  return lines.join('\n');
}
