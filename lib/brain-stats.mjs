#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Brain Stats — Brain Knowledge Base Statistics
// ──────────────────────────────────────────────

export function runBrainStats(workspace) {
  const brainDir = workspace.brainDir;
  const currentPath = path.join(brainDir, 'current.json');
  const historyPath = path.join(brainDir, 'history.jsonl');

  if (!fs.existsSync(currentPath)) {
    return { error: `Brain not found at ${currentPath}` };
  }

  const entries = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
  if (!Array.isArray(entries) || entries.length === 0) {
    return { error: 'Brain is empty — no entries to analyze' };
  }

  const history = loadHistory(historyPath);

  // By scope
  const byScope = countBy(entries, 'scope');

  // By quality
  const byQuality = countBy(entries, 'quality');

  // By domain
  const byDomain = countBy(entries, 'domain');

  // Tags frequency
  const tagFreq = computeTagFrequency(entries);

  // Age analysis
  const ages = entries.map(e => {
    const created = new Date(e.created_at || e.timestamp || Date.now());
    return Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
  });
  const avgAge = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length);
  const maxAge = Math.max(...ages);
  const minAge = Math.min(...ages);

  // Entries with/without tags
  const withTags = entries.filter(e => e.tags && e.tags.length > 0).length;
  const withoutTags = entries.length - withTags;
  const withEvidence = entries.filter(e => e.evidence).length;
  const withoutEvidence = entries.length - withEvidence;

  // Game tags
  const gameTags = entries.flatMap(e => e.tags || [])
    .filter(t => t.startsWith('game:'))
    .reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});

  // History summary
  const historySummary = history.length > 0 ? {
    totalEvents: history.length,
    lastEvent: history[history.length - 1]?.timestamp || null,
    addsLast7: history.filter(h => {
      const d = new Date(h.timestamp);
      return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
    }).length,
  } : { totalEvents: 0, lastEvent: null, addsLast7: 0 };

  // Health score
  const hasTagsRatio = withTags / entries.length;
  const hasEvidenceRatio = withEvidence / entries.length;
  const qualityScore = computeQualityScore(byQuality);
  const healthScore = Math.round((hasTagsRatio * 40 + hasEvidenceRatio * 30 + qualityScore * 30));

  return {
    totalEntries: entries.length,
    currentPath,
    historyPath,
    byScope,
    byQuality,
    byDomain,
    tagFrequency: tagFreq.slice(0, 20),
    gameTags,
    ageStats: {
      average: avgAge,
      oldest: maxAge,
      newest: minAge,
      inDays: true,
    },
    tagging: {
      withTags,
      withoutTags,
      tagCoverage: Math.round((withTags / entries.length) * 100),
    },
    evidence: {
      withEvidence,
      withoutEvidence,
      evidenceCoverage: Math.round((withEvidence / entries.length) * 100),
    },
    history: historySummary,
    healthScore: Math.min(100, Math.max(0, healthScore)),
  };
}

// ─── Helpers ───

function countBy(entries, field) {
  const counts = {};
  for (const e of entries) {
    const val = e[field] || 'unknown';
    counts[val] = (counts[val] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
}

function computeTagFrequency(entries) {
  const freq = {};
  for (const e of entries) {
    if (e.tags && Array.isArray(e.tags)) {
      for (const tag of e.tags) {
        freq[tag] = (freq[tag] || 0) + 1;
      }
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));
}

function computeQualityScore(byQuality) {
  const total = Object.values(byQuality).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const high = (byQuality.high || 0) / total;
  const medium = (byQuality.medium || 0) / total;
  return high * 1.0 + medium * 0.5; // low = 0
}

function loadHistory(historyPath) {
  if (!fs.existsSync(historyPath)) return [];
  const lines = fs.readFileSync(historyPath, 'utf8').trim().split('\n').filter(Boolean);
  return lines.map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

// ─── Renderer ───

export function renderBrainStats(result) {
  if (result.error) {
    return `[BRAIN STATS] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push('[BRAIN STATS]');
  lines.push('═'.repeat(52));
  lines.push(`  Total entries:       ${result.totalEntries}`);
  lines.push(`  Health score:        ${result.healthScore}/100`);
  lines.push('');

  // By scope
  lines.push('── By Scope ─────────────────────────────────────');
  for (const [scope, count] of Object.entries(result.byScope)) {
    const bar = '█'.repeat(Math.min(30, count));
    lines.push(`  ${scope.padEnd(20)} ${String(count).padStart(4)} ${bar}`);
  }
  lines.push('');

  // By quality
  lines.push('── By Quality ───────────────────────────────────');
  for (const [quality, count] of Object.entries(result.byQuality)) {
    const icon = quality === 'high' ? '🟢' : quality === 'medium' ? '🟡' : '🔴';
    lines.push(`  ${icon} ${quality.padEnd(15)} ${String(count).padStart(4)}`);
  }
  lines.push('');

  // By domain
  if (Object.keys(result.byDomain).length > 0) {
    lines.push('── By Domain ──────────────────────────────────');
    for (const [domain, count] of Object.entries(result.byDomain)) {
      lines.push(`  ${domain.padEnd(20)} ${String(count).padStart(4)}`);
    }
    lines.push('');
  }

  // Top tags
  if (result.tagFrequency.length > 0) {
    lines.push('── Top Tags ───────────────────────────────────');
    for (const { tag, count } of result.tagFrequency.slice(0, 15)) {
      const bar = '▓'.repeat(Math.min(25, count * 2));
      lines.push(`  ${tag.padEnd(25)} ${String(count).padStart(3)} ${bar}`);
    }
    lines.push('');
  }

  // Game tags
  if (Object.keys(result.gameTags).length > 0) {
    lines.push('── Game Coverage ──────────────────────────────');
    for (const [game, count] of Object.entries(result.gameTags)) {
      lines.push(`  🎮 ${game.padEnd(25)} ${String(count).padStart(3)} entries`);
    }
    lines.push('');
  }

  // Tagging health
  lines.push('── Tagging Health ─────────────────────────────');
  lines.push(`  With tags:     ${result.tagging.withTags}/${result.totalEntries} (${result.tagging.tagCoverage}%)`);
  lines.push(`  Without tags:  ${result.tagging.withoutTags}`);
  lines.push('');

  // Evidence health
  lines.push('── Evidence Health ────────────────────────────');
  lines.push(`  With evidence: ${result.evidence.withEvidence}/${result.totalEntries} (${result.evidence.evidenceCoverage}%)`);
  lines.push(`  Without:       ${result.evidence.withoutEvidence}`);
  lines.push('');

  // Age
  const a = result.ageStats;
  lines.push('── Entry Age ──────────────────────────────────');
  lines.push(`  Average: ${a.average} days`);
  lines.push(`  Oldest:  ${a.oldest} days`);
  lines.push(`  Newest:  ${a.newest} days`);
  lines.push('');

  // History
  const h = result.history;
  lines.push('── Activity ───────────────────────────────────');
  lines.push(`  Total events:    ${h.totalEvents}`);
  lines.push(`  Adds (last 7d):  ${h.addsLast7}`);
  if (h.lastEvent) lines.push(`  Last activity:   ${h.lastEvent}`);
  lines.push('');

  lines.push('═'.repeat(52));
  lines.push(`  Health: ${result.healthScore}/100`);
  if (result.healthScore >= 70) lines.push('  Status: ✅ Healthy');
  else if (result.healthScore >= 40) lines.push('  Status: ⚠️  Needs attention');
  else lines.push('  Status: 🔴 Poor — add tags, evidence, quality');
  lines.push('═'.repeat(52));

  return lines.join('\n');
}
