#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Brain Import — Import Lessons from External Sources
// ──────────────────────────────────────────────

export function runBrainImport(filePath, workspace) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { error: `File not found: ${absPath}` };
  }

  const raw = fs.readFileSync(absPath, 'utf8');
  let entries;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      entries = parsed;
    } else if (parsed.entries && Array.isArray(parsed.entries)) {
      entries = parsed.entries;
    } else if (parsed.lessons && Array.isArray(parsed.lessons)) {
      entries = parsed.lessons;
    } else {
      // Single entry
      entries = [parsed];
    }
  } catch (err) {
    return { error: `Invalid JSON: ${err.message}` };
  }

  // Normalize entries
  const normalized = entries.map(e => normalizeEntry(e));

  // Load current brain
  const brainDir = workspace.brainDir;
  const currentPath = path.join(brainDir, 'current.json');
  const historyPath = path.join(brainDir, 'history.jsonl');

  const existing = loadExisting(currentPath);
  const existingKeys = new Set(existing.map(e => entryKey(e)));

  // Dedupe: skip entries that already exist
  const newEntries = [];
  const skipped = [];

  for (const entry of normalized) {
    const key = entryKey(entry);
    if (existingKeys.has(key)) {
      skipped.push({ key, reason: 'duplicate' });
    } else if (!entry.title || !entry.fact) {
      skipped.push({ key: key || '<unknown>', reason: 'missing title or fact' });
    } else {
      newEntries.push(entry);
    }
  }

  return {
    sourceFile: path.basename(absPath),
    totalInFile: entries.length,
    normalized: normalized.length,
    newEntries,
    newCount: newEntries.length,
    skipped,
    skippedCount: skipped.length,
    existingCount: existing.length,
    currentPath,
    historyPath,
    readyToMerge: newEntries.length > 0,
  };
}

// ─── Merge ───

export function mergeBrainImport(importResult, workspace) {
  if (!importResult.readyToMerge || importResult.error) {
    return { error: 'Nothing to merge' };
  }

  const currentPath = importResult.currentPath;
  const historyPath = importResult.historyPath;

  // Load existing
  const existing = loadExisting(currentPath);

  // Append new entries
  const timestamp = new Date().toISOString();
  const newEntries = importResult.newEntries.map(e => ({
    ...e,
    imported_at: timestamp,
    source: importResult.sourceFile,
  }));

  const merged = [...existing, ...newEntries];

  // Write current.json
  fs.writeFileSync(currentPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');

  // Append to history.jsonl
  const historyEntry = {
    timestamp,
    action: 'import',
    source: importResult.sourceFile,
    entriesAdded: newEntries.length,
    entries: newEntries.map(e => ({ title: e.title, scope: e.scope })),
  };
  fs.appendFileSync(historyPath, JSON.stringify(historyEntry) + '\n', 'utf8');

  return {
    merged: true,
    entriesAdded: newEntries.length,
    totalEntries: merged.length,
    currentPath,
    historyPath,
    timestamp,
  };
}

// ─── Normalize ───

function normalizeEntry(entry) {
  return {
    title: entry.title || entry.name || entry.label || null,
    scope: normalizeScope(entry.scope || entry.type || 'host:qwen'),
    quality: normalizeQuality(entry.quality || entry.severity || entry.priority),
    tags: normalizeTags(entry.tags || entry.tag || entry.labels),
    fact: entry.fact || entry.rule || entry.lesson || entry.content || entry.detail || null,
    evidence: entry.evidence || entry.proof || entry.context || entry.source || null,
    created_at: entry.created_at || entry.date || entry.timestamp || new Date().toISOString(),
    source: entry.source || entry.origin || null,
    domain: entry.domain || entry.category || entry.area || null,
  };
}

function normalizeScope(scope) {
  if (typeof scope !== 'string') return 'host:qwen';
  const s = scope.toLowerCase().trim();

  if (s.startsWith('profile') || s.startsWith('repo')) return 'profile';
  if (s.startsWith('system') || s.startsWith('global')) return 'system';
  if (s.startsWith('host') || s.startsWith('qwen') || s.startsWith('claude') || s.startsWith('codex')) {
    // Normalize to host:<name>
    if (s.includes('qwen')) return 'host:qwen';
    if (s.includes('claude')) return 'host:claude';
    if (s.includes('codex')) return 'host:codex';
    return 'host:qwen';
  }

  // If it looks like a domain
  if (['logic', 'ui', 'framing', 'terminology', 'compat', 'lifecycle', 'update', 'config', 'optimization', 'regression-proof'].includes(s)) {
    return `domain:${s}`;
  }

  return 'host:qwen';
}

function normalizeQuality(quality) {
  if (typeof quality === 'number') {
    if (quality >= 80) return 'high';
    if (quality >= 50) return 'medium';
    return 'low';
  }

  const q = String(quality || 'medium').toLowerCase().trim();
  if (['high', 'critical', 'severe', 'blocker'].includes(q)) return 'high';
  if (['low', 'info', 'minor'].includes(q)) return 'low';
  return 'medium';
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (typeof tags === 'string') return [tags];
  if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
  return [];
}

// ─── Entry Key (for deduplication) ───

function entryKey(entry) {
  const title = (entry.title || '').toLowerCase().trim();
  const fact = (entry.fact || '').toLowerCase().trim().slice(0, 100);
  return `${entry.scope}|${title}|${hashShort(fact)}`;
}

function hashShort(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit int
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

// ─── Load Existing ───

function loadExisting(currentPath) {
  if (!fs.existsSync(currentPath)) return [];
  try {
    const raw = fs.readFileSync(currentPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Renderer ───

export function renderBrainImport(result) {
  if (result.error) {
    return `[BRAIN IMPORT] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push(`[BRAIN IMPORT] ${result.sourceFile}`);
  lines.push('═'.repeat(52));
  lines.push('');
  lines.push(`  Entries in file:     ${result.totalInFile}`);
  lines.push(`  Normalized:          ${result.normalized}`);
  lines.push(`  New (unique):        ${result.newCount}`);
  lines.push(`  Skipped (dupe):      ${result.skippedCount}`);
  lines.push(`  Existing in brain:   ${result.existingCount}`);
  lines.push('');

  if (result.newEntries.length > 0) {
    lines.push('── New Entries ───────────────────────────────────');
    for (let i = 0; i < result.newEntries.length; i++) {
      const e = result.newEntries[i];
      lines.push(`  ${i + 1}. ${e.title}`);
      lines.push(`     Scope:    ${e.scope}`);
      lines.push(`     Quality:  ${e.quality}`);
      if (e.tags.length > 0) lines.push(`     Tags:     ${e.tags.join(', ')}`);
      if (e.domain) lines.push(`     Domain:   ${e.domain}`);
      lines.push(`     Fact:     ${e.fact?.slice(0, 120)}${e.fact?.length > 120 ? '...' : ''}`);
      lines.push('');
    }
  }

  if (result.skipped.length > 0) {
    lines.push('── Skipped ──────────────────────────────────────');
    for (const s of result.skipped.slice(0, 10)) {
      lines.push(`  ⏭️  ${s.key} — ${s.reason}`);
    }
    if (result.skipped.length > 10) {
      lines.push(`  ... and ${result.skipped.length - 10} more`);
    }
    lines.push('');
  }

  lines.push('═'.repeat(52));
  if (result.readyToMerge) {
    lines.push(`  Ready to merge: YES (${result.newCount} new entries)`);
    lines.push(`  Run: agent-system brain import --merge <file>`);
  } else {
    lines.push('  Ready to merge: NO (all entries already exist)');
  }
  lines.push('═'.repeat(52));

  return lines.join('\n');
}

export function renderBrainMerge(result) {
  if (result.error) {
    return `[BRAIN MERGE] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push('[BRAIN MERGE]');
  lines.push('═'.repeat(52));
  lines.push(`  Entries added:   ${result.entriesAdded}`);
  lines.push(`  Total entries:   ${result.totalEntries}`);
  lines.push(`  Timestamp:       ${result.timestamp}`);
  lines.push(`  Current:         ${result.currentPath}`);
  lines.push(`  History:         ${result.historyPath}`);
  lines.push('═'.repeat(52));
  lines.push('  Status: MERGED ✅');
  lines.push('═'.repeat(52));

  return lines.join('\n');
}
