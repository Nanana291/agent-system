import fs from 'node:fs';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '.json',
  '.jsonl',
  '.md',
  '.mjs',
  '.js',
  '.cjs',
  '.txt',
  '.sh',
  '.yml',
  '.yaml',
]);

const UI_CONTROL_PATTERN = /\bCreate(?:Toggle|Button|Slider|Dropdown|Textbox|Input|Section|Label|ColorPicker)\b/g;
const REMOTE_PATTERN = /\b(?:FireServer|InvokeServer)\s*\(/g;
const FLAG_PATTERN = /\bflags?(?:\.|\[)/g;
const LOCAL_PATTERN = /\b(?:const|let|local)\s+[A-Za-z_][A-Za-z0-9_]*/g;
const CALLBACK_PATTERN = /\bcallback\b|\.Connect\s*\(/g;
const ESP_PATTERN = /\b(?:RenderStepped|Heartbeat|Stepped|Drawing\.new)\b/g;
const THREAD_PATTERN = /\b(?:task\.spawn|spawn|coroutine\.(?:wrap|create|resume))\s*\(([^)]*)\)/g;

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function walkFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!fs.existsSync(current)) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === '.worktrees' || entry.name === 'node_modules') {
        continue;
      }
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }
  return files.sort();
}

function countMatches(text, pattern) {
  const matches = String(text || '').match(pattern);
  return matches ? matches.length : 0;
}

function countPcallCoverageByLines(text) {
  const lines = String(text || '').split(/\r?\n/);
  let total = 0;
  let covered = 0;

  for (let index = 0; index < lines.length; index += 1) {
    if (!REMOTE_PATTERN.test(lines[index])) {
      REMOTE_PATTERN.lastIndex = 0;
      continue;
    }
    REMOTE_PATTERN.lastIndex = 0;
    total += 1;
    const start = Math.max(0, index - 5);
    const windowText = lines.slice(start, index + 1).join('\n');
    if (/\bpcall\s*\(/.test(windowText)) {
      covered += 1;
    }
  }

  return { total, covered };
}

function countThreads(text) {
  let named = 0;
  let anonymous = 0;
  for (const match of String(text || '').matchAll(THREAD_PATTERN)) {
    const args = String(match[1] || '').trim();
    if (/^(function\b|\(?\s*[^)]*\s*\)?\s*=>)/.test(args)) {
      anonymous += 1;
    } else if (args.length > 0) {
      named += 1;
    } else {
      anonymous += 1;
    }
  }
  return { named, anonymous };
}

function relativePath(workspace, filePath) {
  return path.relative(workspace.repoRoot, filePath).replaceAll(path.sep, '/');
}

function readJsonSafe(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function bootstrapSnapshot(workspace) {
  return {
    kind: 'agent-system-metrics',
    version: 1,
    source: 'bootstrap',
    generatedAt: '2026-04-08T00:00:00.000Z',
    activeProfile: workspace.activeProfileName,
    activeHost: workspace.activeHostName,
    totals: {
      files: 0,
      lines: 0,
      locals: 0,
      remotes: 0,
      callbacks: 0,
      flags: 0,
      uiControls: 0,
      espConnections: 0,
      threadsNamed: 0,
      threadsAnonymous: 0,
    },
    coverage: {
      pcall: 0,
    },
    risks: {
      total: 0,
      bySeverity: {},
    },
    brain: {
      totalNotes: 0,
      tags: {},
    },
    summaryPath: relativePath(workspace, workspace.metricsCurrentPath),
    snapshotPath: relativePath(workspace, path.join(workspace.metricsSnapshotsDir, 'bootstrap.json')),
    historyPath: relativePath(workspace, workspace.metricsHistoryPath),
  };
}

function readBrainTagCounts(workspace) {
  const current = readJsonSafe(workspace.brainCurrentPath, { entries: [], counts: { total: 0 } });
  const tags = {};
  for (const entry of current.entries || []) {
    for (const tag of entry.tags || []) {
      const normalized = normalize(tag);
      if (!normalized) continue;
      tags[normalized] = (tags[normalized] || 0) + 1;
    }
  }
  return {
    totalNotes: current.counts?.total || 0,
    tags,
  };
}

function readRiskCounts(workspace) {
  const current = readJsonSafe(path.join(workspace.repoRoot, 'docs', 'luau', 'current.json'), { issues: [] });
  const bySeverity = {};
  for (const issue of current.issues || []) {
    const severity = normalize(issue.severity || issue.risk || issue.level);
    if (!severity) continue;
    bySeverity[severity] = (bySeverity[severity] || 0) + 1;
  }
  return {
    total: Object.values(bySeverity).reduce((sum, value) => sum + value, 0),
    bySeverity,
  };
}

export function captureMetricsSnapshot(workspace, source = 'manual') {
  const files = walkFiles(workspace.repoRoot);
  const totals = {
    files: files.length,
    lines: 0,
    locals: 0,
    remotes: 0,
    callbacks: 0,
    flags: 0,
    uiControls: 0,
    espConnections: 0,
    threadsNamed: 0,
    threadsAnonymous: 0,
  };
  let remoteCalls = 0;
  let coveredRemoteCalls = 0;

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, 'utf8');
    totals.lines += text.split(/\r?\n/).length;
    totals.locals += countMatches(text, LOCAL_PATTERN);
    totals.remotes += countMatches(text, REMOTE_PATTERN);
    totals.callbacks += countMatches(text, CALLBACK_PATTERN);
    totals.flags += countMatches(text, FLAG_PATTERN);
    totals.uiControls += countMatches(text, UI_CONTROL_PATTERN);
    totals.espConnections += countMatches(text, ESP_PATTERN);
    const threads = countThreads(text);
    totals.threadsNamed += threads.named;
    totals.threadsAnonymous += threads.anonymous;
    const pcallCoverage = countPcallCoverageByLines(text);
    remoteCalls += pcallCoverage.total;
    coveredRemoteCalls += pcallCoverage.covered;
  }

  const generatedAt = new Date().toISOString();
  const fileName = `${generatedAt.replace(/[:.]/g, '-')}.json`;
  const snapshotPath = path.join(workspace.metricsSnapshotsDir, fileName);

  return {
    kind: 'agent-system-metrics',
    version: 1,
    source,
    generatedAt,
    activeProfile: workspace.activeProfileName,
    activeHost: workspace.activeHostName,
    totals,
    coverage: {
      pcall: remoteCalls > 0 ? Number(((coveredRemoteCalls / remoteCalls) * 100).toFixed(2)) : 0,
    },
    risks: readRiskCounts(workspace),
    brain: readBrainTagCounts(workspace),
    summaryPath: relativePath(workspace, workspace.metricsCurrentPath),
    snapshotPath: relativePath(workspace, snapshotPath),
    historyPath: relativePath(workspace, workspace.metricsHistoryPath),
  };
}

export function writeMetricsSnapshot(workspace, source = 'manual') {
  const snapshot = captureMetricsSnapshot(workspace, source);
  ensureDir(workspace.metricsDir);
  ensureDir(workspace.metricsSnapshotsDir);
  fs.writeFileSync(workspace.metricsCurrentPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  fs.appendFileSync(workspace.metricsHistoryPath, JSON.stringify({
    ...snapshot,
    recordedAt: snapshot.generatedAt,
  }) + '\n', 'utf8');
  fs.writeFileSync(path.join(workspace.repoRoot, snapshot.snapshotPath), JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  return snapshot;
}

export function readMetricsCurrent(workspace) {
  return readJsonSafe(workspace.metricsCurrentPath, bootstrapSnapshot(workspace));
}

export function readMetricsHistory(workspace) {
  if (!fs.existsSync(workspace.metricsHistoryPath)) {
    return [];
  }
  const entries = [];
  for (const line of fs.readFileSync(workspace.metricsHistoryPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      continue;
    }
  }
  return entries;
}

function diffNumbers(current, previous) {
  return Number((Number(current || 0) - Number(previous || 0)).toFixed(2));
}

export function diffMetrics(current, previous) {
  const prior = previous || bootstrapSnapshot({
    ...current,
    repoRoot: '.',
    metricsCurrentPath: current.summaryPath || 'docs/metrics/current.json',
    metricsHistoryPath: current.historyPath || 'docs/metrics/history.jsonl',
    metricsSnapshotsDir: 'docs/metrics/snapshots',
  });
  return {
    files: diffNumbers(current.totals?.files, prior.totals?.files),
    lines: diffNumbers(current.totals?.lines, prior.totals?.lines),
    locals: diffNumbers(current.totals?.locals, prior.totals?.locals),
    remotes: diffNumbers(current.totals?.remotes, prior.totals?.remotes),
    callbacks: diffNumbers(current.totals?.callbacks, prior.totals?.callbacks),
    flags: diffNumbers(current.totals?.flags, prior.totals?.flags),
    uiControls: diffNumbers(current.totals?.uiControls, prior.totals?.uiControls),
    pcall: diffNumbers(current.coverage?.pcall, prior.coverage?.pcall),
    totalRisks: diffNumbers(current.risks?.total, prior.risks?.total),
    totalNotes: diffNumbers(current.brain?.totalNotes, prior.brain?.totalNotes),
  };
}

export function buildMetricsReport(workspace) {
  const current = readMetricsCurrent(workspace);
  const history = readMetricsHistory(workspace);
  const previous = history.length > 1 ? history[history.length - 2] : null;
  const baseline = history.length > 0 ? history[0] : null;
  return {
    current,
    previous,
    baseline,
    historyCount: history.length,
    delta: diffMetrics(current, previous),
    baselineDelta: diffMetrics(current, baseline),
  };
}

export function buildMetricsCompareReport(workspace, references = []) {
  const inputs = references.filter(Boolean);
  const resolveReference = (ref) => {
    if (!ref || ref === 'current') return readMetricsCurrent(workspace);
    const fullPath = path.isAbsolute(ref) ? ref : path.resolve(workspace.repoRoot, ref);
    return readJsonSafe(fullPath, readMetricsCurrent(workspace));
  };
  const left = resolveReference(inputs[0] || 'current');
  const right = resolveReference(inputs[1] || (inputs[0] ? 'current' : readMetricsHistory(workspace).at(-2)?.snapshotPath || 'current'));
  return {
    left,
    right,
    delta: diffMetrics(left, right),
  };
}

function renderDeltaLine(label, value, suffix = '') {
  const prefix = value > 0 ? '+' : '';
  return `- ${label}: ${prefix}${value}${suffix}`;
}

export function renderMetricsSummary(report) {
  const current = report.current || report;
  const delta = report.delta || diffMetrics(current, null);
  return [
    '[METRICS]',
    `Source: ${current.source}`,
    `Generated: ${current.generatedAt}`,
    `Files: ${current.totals?.files || 0}`,
    `Lines: ${current.totals?.lines || 0}`,
    `Locals: ${current.totals?.locals || 0}`,
    `Remotes: ${current.totals?.remotes || 0}`,
    `Callbacks: ${current.totals?.callbacks || 0}`,
    `Flags: ${current.totals?.flags || 0}`,
    `UI controls: ${current.totals?.uiControls || 0}`,
    `ESP connections: ${current.totals?.espConnections || 0}`,
    `Threads: named=${current.totals?.threadsNamed || 0}, anonymous=${current.totals?.threadsAnonymous || 0}`,
    `pcall coverage: ${current.coverage?.pcall || 0}%`,
    `Risks: ${current.risks?.total || 0}`,
    `Brain notes: ${current.brain?.totalNotes || 0}`,
    `Snapshot: ${current.snapshotPath}`,
    'Delta:',
    renderDeltaLine('files', delta.files),
    renderDeltaLine('lines', delta.lines),
    renderDeltaLine('locals', delta.locals),
    renderDeltaLine('remotes', delta.remotes),
    renderDeltaLine('pcall coverage', delta.pcall, '%'),
  ].join('\n');
}

export function renderMetricsTrend(report) {
  const current = report.current;
  const previous = report.previous;
  const baseline = report.baseline;
  return [
    '[METRICS TREND]',
    `History entries: ${report.historyCount}`,
    `Current: ${current.generatedAt}`,
    `Previous: ${previous?.generatedAt || 'none'}`,
    `Baseline: ${baseline?.generatedAt || 'none'}`,
    'Delta:',
    renderDeltaLine('files', report.delta.files),
    renderDeltaLine('lines', report.delta.lines),
    renderDeltaLine('locals', report.delta.locals),
    renderDeltaLine('remotes', report.delta.remotes),
    renderDeltaLine('flags', report.delta.flags),
    renderDeltaLine('pcall coverage', report.delta.pcall, '%'),
    'Baseline delta:',
    renderDeltaLine('files', report.baselineDelta.files),
    renderDeltaLine('lines', report.baselineDelta.lines),
    renderDeltaLine('locals', report.baselineDelta.locals),
    renderDeltaLine('remotes', report.baselineDelta.remotes),
    renderDeltaLine('pcall coverage', report.baselineDelta.pcall, '%'),
  ].join('\n');
}

export function renderMetricsCompare(report) {
  return [
    '[METRICS COMPARE]',
    `Left: ${report.left.snapshotPath || report.left.summaryPath || 'current'}`,
    `Right: ${report.right.snapshotPath || report.right.summaryPath || 'current'}`,
    'Delta:',
    renderDeltaLine('files', report.delta.files),
    renderDeltaLine('lines', report.delta.lines),
    renderDeltaLine('locals', report.delta.locals),
    renderDeltaLine('remotes', report.delta.remotes),
    renderDeltaLine('callbacks', report.delta.callbacks),
    renderDeltaLine('flags', report.delta.flags),
    renderDeltaLine('pcall coverage', report.delta.pcall, '%'),
    renderDeltaLine('risks', report.delta.totalRisks),
    renderDeltaLine('brain notes', report.delta.totalNotes),
  ].join('\n');
}
