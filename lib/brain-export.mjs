#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Brain Export — Export Brain to Portable JSON
// ──────────────────────────────────────────────

export function runBrainExport(options, workspace) {
  const brainDir = workspace.brainDir;
  const currentPath = path.join(brainDir, 'current.json');

  if (!fs.existsSync(currentPath)) {
    return { error: `Brain not found at ${currentPath}` };
  }

  const raw = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
  // Support both formats: plain array and { entries: [...] } object format
  const entries = Array.isArray(raw) ? raw : (raw.entries || []);
  if (entries.length === 0) {
    return { error: 'Brain is empty — no entries to export' };
  }

  // Apply filters
  let filtered = entries;

  if (options.scope) {
    filtered = filtered.filter(e => e.scope === options.scope);
  }

  if (options.tag) {
    const tags = Array.isArray(options.tag) ? options.tag : [options.tag];
    filtered = filtered.filter(e => {
      if (!e.tags || !Array.isArray(e.tags)) return false;
      return tags.some(t => e.tags.includes(t));
    });
  }

  if (options.quality) {
    filtered = filtered.filter(e => e.quality === options.quality);
  }

  if (options.domain) {
    filtered = filtered.filter(e => e.domain === options.domain);
  }

  if (options.search) {
    const q = options.search.toLowerCase();
    filtered = filtered.filter(e =>
      (e.title || '').toLowerCase().includes(q) ||
      (e.fact || '').toLowerCase().includes(q) ||
      (e.evidence || '').toLowerCase().includes(q)
    );
  }

  // Build export object
  const exportData = {
    exported_at: new Date().toISOString(),
    source: 'agent-system-brain',
    filter: {
      scope: options.scope || null,
      tag: options.tag || null,
      quality: options.quality || null,
      domain: options.domain || null,
      search: options.search || null,
    },
    totalEntries: filtered.length,
    totalInBrain: entries.length,
    entries: filtered,
  };

  return {
    exportData,
    totalExported: filtered.length,
    totalInBrain: entries.length,
    filteredOut: entries.length - filtered.length,
    outputPath: options.output ? path.resolve(options.output) : null,
  };
}

export function writeBrainExport(result) {
  if (!result.outputPath || result.error) {
    return { error: 'No output path specified' };
  }

  const json = JSON.stringify(result.exportData, null, 2) + '\n';
  fs.writeFileSync(result.outputPath, json, 'utf8');

  return {
    written: true,
    outputPath: result.outputPath,
    bytesWritten: Buffer.byteLength(json, 'utf8'),
    entriesExported: result.totalExported,
  };
}

// ─── Renderer ───

export function renderBrainExport(result) {
  if (result.error) {
    return `[BRAIN EXPORT] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push('[BRAIN EXPORT]');
  lines.push('═'.repeat(52));
  lines.push(`  Total in brain:     ${result.totalInBrain}`);
  lines.push(`  Exported:           ${result.totalExported}`);
  lines.push(`  Filtered out:       ${result.filteredOut}`);
  lines.push('');

  if (result.exportData.filter && Object.values(result.exportData.filter).some(Boolean)) {
    lines.push('── Active Filters ──────────────────────────────');
    const f = result.exportData.filter;
    if (f.scope) lines.push(`  scope:     ${f.scope}`);
    if (f.tag) lines.push(`  tag:       ${Array.isArray(f.tag) ? f.tag.join(', ') : f.tag}`);
    if (f.quality) lines.push(`  quality:   ${f.quality}`);
    if (f.domain) lines.push(`  domain:    ${f.domain}`);
    if (f.search) lines.push(`  search:    "${f.search}"`);
    lines.push('');
  }

  if (result.exportData.entries.length > 0) {
    lines.push('── Entries ─────────────────────────────────────');
    for (let i = 0; i < result.exportData.entries.length; i++) {
      const e = result.exportData.entries[i];
      lines.push(`  ${i + 1}. ${e.title || 'untitled'}`);
      lines.push(`     Scope:    ${e.scope || 'unknown'}`);
      if (e.quality) lines.push(`     Quality:  ${e.quality}`);
      if (e.domain) lines.push(`     Domain:   ${e.domain}`);
      if (e.tags && e.tags.length > 0) lines.push(`     Tags:     ${e.tags.join(', ')}`);
      lines.push(`     Fact:     ${(e.fact || '').slice(0, 100)}${(e.fact || '').length > 100 ? '...' : ''}`);
      lines.push('');
    }
  }

  lines.push('═'.repeat(52));

  if (result.outputPath) {
    lines.push(`  Written to: ${result.outputPath}`);
    lines.push(`  Bytes:      ${result.bytesWritten}`);
  } else {
    lines.push('  Preview mode — add --output <file> to write');
  }

  lines.push('═'.repeat(52));

  return lines.join('\n');
}
