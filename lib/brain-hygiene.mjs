import fs from 'node:fs';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlePrefix(value) {
  return normalizeText(value).split(' ').filter(Boolean).slice(0, 2).join(' ');
}

export function normalizeBrainEntry(entry) {
  return {
    brainId: String(entry?.brainId || ''),
    scope: String(entry?.scope || 'profile'),
    status: String(entry?.status || 'candidate'),
    title: String(entry?.title || ''),
    summary: String(entry?.summary || ''),
    source: String(entry?.source || ''),
    sourcePath: String(entry?.sourcePath || entry?.relatedPaths?.[0] || ''),
    relatedPaths: Array.isArray(entry?.relatedPaths) ? entry.relatedPaths : [],
  };
}

export function similarTitle(left, right) {
  const leftPrefix = titlePrefix(left);
  const rightPrefix = titlePrefix(right);
  return leftPrefix.length > 0 && leftPrefix === rightPrefix;
}

export function findBrainMergeCandidates(entries) {
  const normalizedEntries = entries.map(normalizeBrainEntry);
  const pairs = [];

  for (let i = 0; i < normalizedEntries.length; i += 1) {
    for (let j = i + 1; j < normalizedEntries.length; j += 1) {
      const left = normalizedEntries[i];
      const right = normalizedEntries[j];

      if (left.scope !== right.scope) continue;
      if (!left.title || !right.title) continue;

      if (left.sourcePath && right.sourcePath && left.sourcePath === right.sourcePath) {
        pairs.push({ left, right, reason: 'shared sourcePath' });
        continue;
      }

      if (similarTitle(left.title, right.title) && normalizeText(left.summary) === normalizeText(right.summary)) {
        pairs.push({ left, right, reason: 'similar title and summary' });
      }
    }
  }

  return pairs;
}

export function buildBrainDedupeReport(workspace, scope = 'all') {
  const current = JSON.parse(fs.readFileSync(workspace.brainCurrentPath, 'utf8'));
  const entries = Array.isArray(current.entries) ? current.entries : [];
  const filtered = scope === 'all' ? entries : entries.filter((entry) => String(entry.scope || '').includes(scope));
  const candidates = findBrainMergeCandidates(filtered);

  return {
    scope,
    totalEntries: filtered.length,
    totalCandidates: candidates.length,
    candidates,
  };
}

export function renderBrainDedupeReport(report) {
  const lines = [];
  lines.push('[BRAIN DEDUPE]');
  lines.push(`Scope: ${report.scope}`);
  lines.push(`Entries: ${report.totalEntries}`);
  lines.push(`Merge candidates: ${report.totalCandidates}`);
  for (const candidate of report.candidates) {
    lines.push(`- ${candidate.left.title} <-> ${candidate.right.title} (${candidate.reason})`);
  }
  if (report.totalCandidates === 0) {
    lines.push('- none');
  }
  return lines.join('\n');
}
