# agent-system 0.6.4.4 Metrics Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent metrics spine that captures workspace health snapshots, stores history, and exposes CLI summaries, trend checks, and comparisons while automatically seeding metrics from `train` and `upgrade`.

**Architecture:** Keep `bin/agent-system.mjs` as the public CLI entrypoint, but move metrics capture and comparison into `lib/metrics.mjs` so snapshot creation, history writes, and trend calculations stay testable. Use the same `current.json` + `history.jsonl` + `snapshots/` pattern already used by upgrade and training, and let `train` and `upgrade` append metrics opportunistically after successful runs.

**Tech Stack:** Node.js ESM, `node:test`, JSON/JSONL workspace state, markdown docs, npm scripts.

---

### Task 1: Add the metrics storage layer and snapshot writer

**Files:**
- Create: `lib/metrics.mjs`
- Create: `docs/metrics/README.md`
- Create: `docs/metrics/current.json`
- Create: `docs/metrics/history.jsonl`
- Create: `docs/metrics/snapshots/bootstrap.json`
- Modify: `agent-system.json`
- Modify: `bin/agent-system.mjs`
- Test: `tests/metrics-cli.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
test('metrics snapshot writes current, history, and snapshot files', () => {
  const workspace = createWorkspace();
  try {
    const result = runAgent(['metrics', 'snapshot'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[METRICS\]/);
    assert.match(result.stdout, /Snapshot:/);
    assert.equal(existsSync(path.join(workspace, 'docs', 'metrics', 'current.json')), true);
    assert.equal(existsSync(path.join(workspace, 'docs', 'metrics', 'history.jsonl')), true);
    assert.equal(existsSync(path.join(workspace, 'docs', 'metrics', 'snapshots')), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test to confirm the command and files are missing**

Run: `node --test tests/metrics-cli.test.mjs`

Expected: FAIL because `metrics` does not exist yet and no metrics files are materialized yet.

- [ ] **Step 3: Implement the minimal metrics module and command wiring**

```javascript
export function captureMetricsSnapshot(workspace, source = 'manual') {
  const now = new Date().toISOString();
  const snapshot = {
    kind: 'agent-system-metrics',
    version: 1,
    source,
    generatedAt: now,
    activeProfile: workspace.activeProfileName,
    activeHost: workspace.activeHostName,
    totals: {
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
    risks: {},
    brain: {},
    summaryPath: '',
    snapshotPath: '',
    historyPath: '',
  };
  return snapshot;
}

export function writeMetricsSnapshot(workspace, source = 'manual') {
  const snapshot = captureMetricsSnapshot(workspace, source);
  fs.mkdirSync(path.join(workspace.repoRoot, 'docs', 'metrics', 'snapshots'), { recursive: true });
  fs.writeFileSync(workspace.metricsCurrentPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  fs.appendFileSync(workspace.metricsHistoryPath, JSON.stringify({
    ...snapshot,
    recordedAt: snapshot.generatedAt,
  }) + '\n', 'utf8');
  fs.writeFileSync(path.join(workspace.repoRoot, 'docs', 'metrics', 'snapshots', `${snapshot.generatedAt.replace(/[:.]/g, '-')}.json`), JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  return snapshot;
}
```

```javascript
const metricsCurrentPath = path.join(repoRoot, 'docs', 'metrics', 'current.json');
const metricsHistoryPath = path.join(repoRoot, 'docs', 'metrics', 'history.jsonl');
const metricsSnapshotsDir = path.join(repoRoot, 'docs', 'metrics', 'snapshots');
const metricsReadmePath = path.join(repoRoot, 'docs', 'metrics', 'README.md');

return {
  repoRoot,
  manifest,
  profile,
  profilePath,
  profileDocPath,
  activeProfileName,
  activeHostName,
  metricsCurrentPath,
  metricsHistoryPath,
  metricsSnapshotsDir,
  metricsReadmePath,
};
```

```json
{
  "metrics": {
    "current": "docs/metrics/current.json",
    "history": "docs/metrics/history.jsonl",
    "readme": "docs/metrics/README.md",
    "snapshots": "docs/metrics/snapshots"
  }
}
```

```javascript
case 'metrics':
  handleMetrics(workspace, flags, positional);
  return;
```

- [ ] **Step 4: Run the test again and verify the snapshot path behavior**

Run: `node --test tests/metrics-cli.test.mjs`

Expected: PASS with `metrics snapshot` creating `docs/metrics/current.json`, `docs/metrics/history.jsonl`, and `docs/metrics/snapshots/<timestamp>.json`.

- [ ] **Step 5: Commit the storage layer**

```bash
git add lib/metrics.mjs docs/metrics/README.md docs/metrics/current.json docs/metrics/history.jsonl docs/metrics/snapshots/bootstrap.json bin/agent-system.mjs tests/metrics-cli.test.mjs
git commit -m "feat: add metrics storage spine"
```

### Task 2: Add metrics summary, trend, and compare commands

**Files:**
- Modify: `bin/agent-system.mjs`
- Modify: `lib/metrics.mjs`
- Modify: `tests/metrics-cli.test.mjs`
- Create: `tests/metrics-trend.test.mjs`

- [ ] **Step 1: Write the failing trend test**

```javascript
test('metrics trend compares the current snapshot against recent history', () => {
  const workspace = createWorkspace();
  try {
    runAgent(['metrics', 'snapshot'], workspace);
    runAgent(['metrics', 'snapshot'], workspace);

    const result = runAgent(['metrics', 'trend'], workspace);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[METRICS TREND\]/);
    assert.match(result.stdout, /Delta:/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test and confirm the commands do not exist yet**

Run: `node --test tests/metrics-cli.test.mjs tests/metrics-trend.test.mjs`

Expected: FAIL because `metrics trend` and `metrics compare` have not been wired yet.

- [ ] **Step 3: Implement the summary, trend, and compare renderers**

```javascript
export function buildMetricsReport(workspace) {
  const current = readCurrentMetrics(workspace);
  const history = readMetricsHistory(workspace);
  const previous = history[history.length - 1] || null;

  return {
    current,
    previous,
    delta: previous ? diffMetrics(current, previous) : {},
    trend: buildMetricsTrend(history),
  };
}
```

```javascript
function handleMetrics(workspace, flags, positional) {
  const action = positional[0] || 'show';
  if (action === 'show') {
    printMetricsSummary(buildMetricsReport(workspace));
    return;
  }
  if (action === 'trend') {
    printMetricsTrend(buildMetricsReport(workspace));
    return;
  }
  if (action === 'compare') {
    printMetricsCompare(buildMetricsCompareReport(workspace, flags, positional.slice(1)));
    return;
  }
  if (action === 'snapshot') {
    printMetricsSummary(writeMetricsSnapshot(workspace, 'manual'));
    return;
  }
  console.error(`Unknown metrics action: ${action}`);
  process.exit(1);
}
```

- [ ] **Step 4: Run the trend and compare tests until they pass**

Run: `node --test tests/metrics-cli.test.mjs tests/metrics-trend.test.mjs`

Expected: PASS with a readable current summary, delta, and trend output.

- [ ] **Step 5: Commit the CLI surface**

```bash
git add bin/agent-system.mjs lib/metrics.mjs tests/metrics-cli.test.mjs tests/metrics-trend.test.mjs
git commit -m "feat: add metrics summary and trend commands"
```

### Task 3: Auto-populate metrics from train and upgrade

**Files:**
- Modify: `bin/agent-system.mjs`
- Modify: `tests/train-cli.test.mjs`
- Modify: `tests/upgrade-cli.test.mjs`
- Create: `tests/metrics-auto-populate.test.mjs`

- [ ] **Step 1: Write the failing auto-population test**

```javascript
test('train auto-populates docs/metrics/current.json and history.jsonl', () => {
  const workspace = createWorkspace();
  try {
    const result = runAgent(['train'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(path.join(workspace, 'docs', 'metrics', 'current.json')), true);
    assert.equal(existsSync(path.join(workspace, 'docs', 'metrics', 'history.jsonl')), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test and verify the metrics files are still absent**

Run: `node --test tests/metrics-auto-populate.test.mjs`

Expected: FAIL because `train` and `upgrade` do not yet write metrics snapshots.

- [ ] **Step 3: Add metrics capture hooks to train and upgrade**

```javascript
function handleTrain(workspace, flags, positional) {
  const report = buildTrainingReport(workspace, hostName, mode, { luau: Boolean(flags.luau) });
  syncTrainingArtifacts(workspace, report);
  writeTrainingRecord(workspace, report);
  captureTrainingMemory(workspace, report);
  const continuity = applyTrainingContinuity(workspace, report, hostName);
  writeMetricsSnapshot(workspace, 'train');
}
```

```javascript
function handleUpgradeApply(workspace, sourceText, targetPath, activeHost, scope) {
  const report = buildUpgradeLearningReport(workspace, sourceText, targetPath, activeHost, 'apply');
  const current = persistUpgradeSnapshot(workspace, report, 'apply');
  syncUpgradeArtifacts(workspace, current, scope);
  writeMetricsSnapshot(workspace, 'upgrade');
}

function handleUpgradeSync(workspace, targetPath, activeHost, scope) {
  const current = readUpgradeCurrent(workspace);
  if (!current || !Array.isArray(current.agents) || current.agents.length === 0) {
    console.error('No upgrade state found. Run `agent-system upgrade learn` first.');
    process.exit(1);
  }
  const report = {
    ...current,
    mode: 'sync',
    outcome: 'synced',
    activeHost: normalizeHostName(activeHost || current.activeHost || workspace.activeHostName),
    targetPath: current.targetPath || targetPath,
    scope: scope || current.scope || resolveUpgradeSyncScope('cycle'),
    generatedAt: new Date().toISOString(),
  };
  const persisted = persistUpgradeSnapshot(workspace, report, 'sync');
  syncUpgradeArtifacts(workspace, persisted, scope || persisted.scope);
  writeMetricsSnapshot(workspace, 'upgrade');
}
```

- [ ] **Step 4: Run the auto-population tests and verify metrics appear after train/upgrade**

Run: `node --test tests/metrics-auto-populate.test.mjs tests/train-cli.test.mjs tests/upgrade-cli.test.mjs`

Expected: PASS and the metrics files should be present after each successful run.

- [ ] **Step 5: Commit the hooks**

```bash
git add bin/agent-system.mjs tests/train-cli.test.mjs tests/upgrade-cli.test.mjs tests/metrics-auto-populate.test.mjs
git commit -m "feat: auto-populate metrics from train and upgrade"
```

### Task 4: Document the metrics surface and close the release

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/baselines/agent-system.mjs.md`
- Modify: `package.json`
- Create: `commands/metrics.md`
- Create: `commands/metrics-trend.md`
- Create: `commands/metrics-compare.md`
- Modify: `tests/surface-contract.test.mjs`
- Create: `docs/metrics/snapshots/2026-04-08T00:00:00Z.json`

- [ ] **Step 1: Write the failing surface test**

```javascript
test('release surface exposes metrics scripts and docs', () => {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

  assert.equal(pkg.scripts.metrics, 'node ./bin/agent-system.mjs metrics');
  assert.equal(pkg.scripts['metrics-trend'], 'node ./bin/agent-system.mjs metrics trend');
  assert.equal(pkg.scripts['metrics-compare'], 'node ./bin/agent-system.mjs metrics compare');
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'metrics.md')), true);
});
```

- [ ] **Step 2: Run the surface test and confirm the scripts are missing**

Run: `node --test tests/surface-contract.test.mjs`

Expected: FAIL because the metrics surface has not been documented or scripted yet.

- [ ] **Step 3: Add the package scripts and docs**

```json
{
  "metrics": "node ./bin/agent-system.mjs metrics",
  "metrics-trend": "node ./bin/agent-system.mjs metrics trend",
  "metrics-compare": "node ./bin/agent-system.mjs metrics compare"
}
```

```markdown
---
description: Show the current metrics snapshot and optional trend/comparison views
---

Use `metrics` to inspect the current workspace metrics summary.

Requirements:

- print the current totals first
- include `pcall` coverage and risk summary
- support `trend` and `compare`
- stay read-only unless `snapshot` is requested
```

- [ ] **Step 4: Update the repo docs and baseline coverage**

Document the new metrics commands in `README.md`, `AGENTS.md`, and `docs/baselines/agent-system.mjs.md`, and extend `validate` / `lint` in `bin/agent-system.mjs` so the metrics trail is treated as a first-class workspace contract instead of an ad hoc folder.

- [ ] **Step 5: Run the full verification set and commit**

```bash
node --test
node ./bin/agent-system.mjs validate
node ./bin/agent-system.mjs lint
git add README.md AGENTS.md docs/baselines/agent-system.mjs.md package.json commands/metrics.md commands/metrics-trend.md commands/metrics-compare.md tests/surface-contract.test.mjs docs/metrics/snapshots/2026-04-08T00:00:00Z.json
git commit -m "feat: ship agent-system 0.6.4.4 metrics spine"
```
