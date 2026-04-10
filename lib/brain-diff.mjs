#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Brain Diff — Compare Brain States
// ──────────────────────────────────────────────
// Compares current brain against a snapshot,
// or between two profiles. Shows: entries
// added, removed, modified. Useful for tracking
// knowledge evolution after training/upgrades.

export function runBrainDiff(workspace, options = {}) {
  const brainDir = workspace.brainDir;
  const currentPath = path.join(brainDir, 'current.json');

  if (!fs.existsSync(currentPath)) {
    return { error: 'Current brain not found' };
  }

  const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));

  // Determine comparison mode
  let previous = null;
  let mode = '';

  if (options.snapshotFile) {
    // Compare against a snapshot file
    const snapPath = path.resolve(options.snapshotFile);
    if (!fs.existsSync(snapPath)) {
      return { error: `Snapshot file not found: ${snapPath}` };
    }
    const snapData = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
    previous = snapData.entries || snapData;
    mode = 'snapshot';
  } else if (options.before && options.after) {
    // Compare two explicit files
    const beforePath = path.resolve(options.before);
    const afterPath = path.resolve(options.after);
    if (!fs.existsSync(beforePath)) return { error: `Before file not found: ${beforePath}` };
    if (!fs.existsSync(afterPath)) return { error: `After file not found: ${afterPath}` };
    previous = JSON.parse(fs.readFileSync(beforePath, 'utf8'));
    const after = JSON.parse(fs.readFileSync(afterPath, 'utf8'));
    return computeDiff(previous, after, 'files');
  } else if (options.historyIndex) {
    // Compare against a previous history entry
    const historyPath = path.join(brainDir, 'history.jsonl');
    if (!fs.existsSync(historyPath)) {
      return { error: 'Brain history not found' };
    }
    const historyEntries = loadHistory(historyPath);
    const idx = parseInt(options.historyIndex);
    if (isNaN(idx) || idx < 0 || idx >= historyEntries.length) {
      return { error: `Invalid history index: ${idx} (0-${historyEntries.length - 1})` };
    }
    previous = historyEntries[idx].entries || [];
    mode = `history[${idx}]`;
  } else {
    // Default: compare against history[0] (first entry)
    const historyPath = path.join(brainDir, 'history.jsonl');
    if (fs.existsSync(historyPath)) {
      const historyEntries = loadHistory(historyPath);
      if (historyEntries.length > 0) {
        previous = historyEntries[0].entries || [];
        mode = 'history[0]';
      }
    }
  }

  if (!previous || previous.length === 0) {
    return { error: 'No previous brain state to compare against', mode: mode || 'none', currentEntries: current.length };
  }

  return computeDiff(previous, current, mode);
}

// ─── Diff Computation ───

function computeDiff(before, after, mode) {
  // Build key maps
  const beforeMap = buildEntryMap(before);
  const afterMap = buildEntryMap(after);

  const beforeKeys = new Set(beforeMap.keys());
  const afterKeys = new Set(afterMap.keys());

  // Added: in after but not in before
  const added = [];
  for (const key of afterKeys) {
    if (!beforeKeys.has(key)) {
      added.push(afterMap.get(key));
    }
  }

  // Removed: in before but not in after
  const removed = [];
  for (const key of beforeKeys) {
    if (!afterKeys.has(key)) {
      removed.push(beforeMap.get(key));
    }
  }

  // Modified: in both but changed
  const modified = [];
  for (const key of afterKeys) {
    if (beforeKeys.has(key)) {
      const beforeEntry = beforeMap.get(key);
      const afterEntry = afterMap.get(key);
      const changes = compareEntries(beforeEntry, afterEntry);
      if (changes.length > 0) {
        modified.push({
          key,
          title: afterEntry.title || beforeEntry.title,
          changes,
          before: beforeEntry,
          after: afterEntry,
        });
      }
  }
  }

  // Scope analysis
  const scopeChanges = analyzeScopeChanges(added, removed, modified);

  return {
    mode,
    beforeCount: before.length,
    afterCount: after.length,
    delta: after.length - before.length,
    added: added.sort((a, b) => (a.title || '').localeCompare(b.title || '')),
    removed: removed.sort((a, b) => (a.title || '').localeCompare(b.title || '')),
    modified: modified.sort((a, b) => a.title.localeCompare(b.title)),
    scopeChanges,
    summary: {
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      unchanged: before.length - removed.length - modified.length,
    },
    timestamp: new Date().toISOString(),
  };
}

function buildEntryMap(entries) {
  const map = new Map();
  for (const entry of entries) {
    const key = entryKey(entry);
    map.set(key, entry);
  }
  return map;
}

function entryKey(entry) {
  const title = (entry.title || '').toLowerCase().trim();
  const scope = (entry.scope || 'unknown').toLowerCase();
  return `${scope}|${title}`;
}

function compareEntries(before, after) {
  const changes = [];

  if (before.fact !== after.fact) changes.push({ field: 'fact', before: before.fact?.slice(0, 50), after: after.fact?.slice(0, 50) });
  if (before.scope !== after.scope) changes.push({ field: 'scope', before: before.scope, after: after.scope });
  if (before.quality !== after.quality) changes.push({ field: 'quality', before: before.quality, after: after.quality });
  if (JSON.stringify(before.tags || []) !== JSON.stringify(after.tags || [])) changes.push({ field: 'tags', before: before.tags, after: after.tags });
  if (before.evidence !== after.evidence) changes.push({ field: 'evidence', before: before.evidence?.slice(0, 50), after: after.evidence?.slice(0, 50) });

  return changes;
}

function analyzeScopeChanges(added, removed, modified) {
  const beforeScopes = {};
  const afterScopes = {};

  for (const entry of added) {
    const scope = entry.scope || 'unknown';
    afterScopes[scope] = (afterScopes[scope] || 0) + 1;
  }
  for (const entry of removed) {
    const scope = entry.scope || 'unknown';
    beforeScopes[scope] = (beforeScopes[scope] || 0) + 1;
  }
  for (const m of modified) {
    if (m.before?.scope) beforeScopes[m.before.scope] = (beforeScopes[m.before.scope] || 0) + 1;
    if (m.after?.scope) afterScopes[m.after.scope] = (afterScopes[m.after.scope] || 0) + 1;
  }

  return {
    beforeScopes,
    afterScopes,
    newScopes: Object.keys(afterScopes).filter(s => !beforeScopes[s]),
    lostScopes: Object.keys(beforeScopes).filter(s => !afterScopes[s]),
  };
}

function loadHistory(historyPath) {
  const content = fs.readFileSync(historyPath, 'utf8').trim();
  if (!content) return [];
  return content.split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

// ─── Renderers ───

export function renderBrainDiff(result) {
  if (result.error) {
    return `[BRAIN DIFF] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push('[BRAIN DIFF]');
  lines.push(`Mode: ${result.mode}`);
  lines.push(`Timestamp: ${result.timestamp}`);
  lines.push('═'.repeat(52));
  lines.push(`  Before: ${result.beforeCount} entries`);
  lines.push(`  After:  ${result.afterCount} entries`);
  lines.push(`  Delta:  ${result.delta > 0 ? '+' : ''}${result.delta}`);
  lines.push('');

  // Summary
  lines.push(`  Added:      ${result.summary.added}`);
  lines.push(`  Removed:    ${result.summary.removed}`);
  lines.push(`  Modified:   ${result.summary.modified}`);
  lines.push(`  Unchanged:  ${result.summary.unchanged}`);
  lines.push('');

  // Added entries
  if (result.added.length > 0) {
    lines.push(`── Added (${result.added.length}) ────────────────────────────`);
    for (const entry of result.added) {
      const scope = entry.scope || 'unknown';
      const quality = entry.quality ? ` [${entry.quality}]` : '';
      lines.push(`  ➕ ${entry.title || 'untitled'}${quality} (${scope})`);
      if (entry.fact) lines.push(`     ${entry.fact.slice(0, 100)}${entry.fact.length > 100 ? '...' : ''}`);
    }
    lines.push('');
  }

  // Removed entries
  if (result.removed.length > 0) {
    lines.push(`── Removed (${result.removed.length}) ────────────────────────`);
    for (const entry of result.removed) {
      const scope = entry.scope || 'unknown';
      lines.push(`  ➖ ${entry.title || 'untitled'} (${scope})`);
    }
    lines.push('');
  }

  // Modified entries
  if (result.modified.length > 0) {
    lines.push(`── Modified (${result.modified.length}) ──────────────────────`);
    for (const entry of result.modified) {
      lines.push(`  🔄 ${entry.title}`);
      for (const change of entry.changes) {
        const beforeStr = change.before !== undefined ? String(change.before).slice(0, 40) : '—';
        const afterStr = change.after !== undefined ? String(change.after).slice(0, 40) : '—';
        lines.push(`     ${change.field}: "${beforeStr}" → "${afterStr}"`);
      }
    }
    lines.push('');
  }

  // Scope changes
  if (result.scopeChanges.newScopes.length > 0 || result.scopeChanges.lostScopes.length > 0) {
    lines.push('── Scope Changes ───────────────────────────────');
    if (result.scopeChanges.newScopes.length > 0) {
      lines.push(`  New scopes:    ${result.scopeChanges.newScopes.join(', ')}`);
    }
    if (result.scopeChanges.lostScopes.length > 0) {
      lines.push(`  Lost scopes:   ${result.scopeChanges.lostScopes.join(', ')}`);
    }
    lines.push('');
  }

  lines.push('═'.repeat(52));
  lines.push(`  ${result.summary.added} added, ${result.summary.removed} removed, ${result.summary.modified} modified`);
  lines.push('═'.repeat(52));

  return lines.join('\n');
}

export function renderBrainDiffJSON(result) {
  return JSON.stringify(result, null, 2);
}
