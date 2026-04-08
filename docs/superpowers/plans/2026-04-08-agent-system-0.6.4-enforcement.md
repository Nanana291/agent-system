# agent-system 0.6.4 Enforcement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the critical `upgrade`, `brain`, `backup`, and delivery flows into executable enforcement paths so the repo no longer depends on prompt discipline for proof, drift detection, or artifact closure.

**Architecture:** Keep `bin/agent-system.mjs` as the single public entrypoint, but move proof logic into small `lib/` modules and thin wrapper executables for the high-risk commands. The CLI should still understand the same human-facing contracts, but every release-critical action must validate artifacts, compare against baseline/session state, and fail closed when proof is missing or drift is detected.

**Tech Stack:** Node.js ESM, `node:test`, JSON/JSONL workspace state, markdown command docs, npm scripts.

---

### Task 1: Add delivery artifact enforcement and a real delivery gate command

**Files:**
- Create: `lib/artifacts.mjs`
- Create: `bin/delivery-check.mjs`
- Modify: `bin/agent-system.mjs`
- Test: `tests/delivery-check-cli.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
test('delivery-check blocks when required artifacts are missing', () => {
  const result = runAgent(['delivery-check'], workspace);

  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /\[DELIVERY GATE\]/);
  assert.match(result.stdout, /Blocked/);
  assert.match(result.stdout, /missing brain current/);
  assert.match(result.stdout, /missing training current/);
});
```

- [ ] **Step 2: Run the test and verify it fails for the right reason**

Run: `node --test tests/delivery-check-cli.test.mjs`

Expected: FAIL because `delivery-check` does not exist yet or because the required artifacts are not validated yet.

- [ ] **Step 3: Implement the minimal artifact validator and gate renderer**

```javascript
export function validateDeliveryArtifacts(workspace) {
  const requiredFiles = [
    workspace.brainCurrentPath,
    workspace.brainHistoryPath,
    workspace.trainingCurrentPath,
    workspace.trainingHistoryPath,
    workspace.changeCurrentPath,
    workspace.changeHistoryPath,
    workspace.statusCurrentPath,
    workspace.statusEventsPath,
    path.join(workspace.repoRoot, 'docs', 'upgrade', 'current.json'),
    path.join(workspace.repoRoot, 'docs', 'upgrade', 'history.jsonl'),
    path.join(workspace.repoRoot, 'docs', 'upgrade', 'sessions', 'README.md'),
    workspace.hostMemoryPath,
    workspace.changeMemoryPath,
    workspace.packMemoryPath,
    path.join(workspace.repoRoot, workspace.profile?.memory?.profileMemory || `memory/profile/${workspace.activeProfileName}.md`),
    workspace.profilePath,
    workspace.profileDocPath,
  ];

  const missing = requiredFiles
    .filter((filePath) => !existsSync(filePath))
    .map((filePath) => path.relative(workspace.repoRoot, filePath));

  return {
    ok: missing.length === 0,
    missing,
  };
}

export function renderDeliveryGate(report) {
  return [
    '[DELIVERY GATE]',
    `Baseline updated: ${report.baselineUpdated}`,
    `Regression matrix: ${report.regressionMatrix}`,
    `Old->new mapping: ${report.oldToNewMapping}`,
    `Owned domains closed: ${report.ownedDomainsClosed}`,
    `Open risks: ${report.openRisks.join(', ') || 'none'}`,
    `Blocked / Ready: ${report.blockedOrReady}`,
  ].join('\n');
}
```

- [ ] **Step 4: Wire the new command into the CLI and wrapper**

```javascript
case 'delivery-check':
  handleDeliveryCheck(workspace);
  return;
```

```javascript
#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agent-system.mjs');
const result = spawnSync(process.execPath, [cli, 'delivery-check', ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
```

- [ ] **Step 5: Verify the gate and commit**

```bash
node --test tests/delivery-check-cli.test.mjs
node ./bin/agent-system.mjs delivery-check
```

### Task 2: Split upgrade into apply, sync, and replay with drift detection

**Files:**
- Create: `lib/upgrade.mjs`
- Create: `bin/upgrade-apply.mjs`
- Create: `bin/upgrade-sync.mjs`
- Create: `bin/upgrade-replay.mjs`
- Create: `docs/upgrade/README.md`
- Create: `docs/upgrade/current.json`
- Create: `docs/upgrade/history.jsonl`
- Create: `docs/upgrade/sessions/README.md`
- Modify: `bin/agent-system.mjs`
- Modify: `commands/upgrade-apply.md`
- Modify: `commands/upgrade-sync.md`
- Modify: `commands/upgrade-replay.md`
- Test: `tests/upgrade-cli.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
test('upgrade replay blocks when the materialized docs drift from the last session', () => {
  const workspace = createWorkspace();
  try {
    const apply = runAgent(['upgrade', 'apply', '--host', 'qwen'], workspace);
    assert.equal(apply.status, 0, apply.stderr);

    writeFileSync(path.join(workspace, 'AGENTS.md'), '# drifted\n', 'utf8');

    const replay = runAgent(['upgrade', 'replay', '--host', 'qwen'], workspace);
    assert.notEqual(replay.status, 0);
    assert.match(replay.stdout, /Drift:/);
    assert.match(replay.stdout, /AGENTS.md/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/upgrade-cli.test.mjs`

Expected: FAIL because `upgrade apply/replay` is not implemented as a real split flow yet.

- [ ] **Step 3: Implement the upgrade session helpers and replay comparison**

```javascript
export function buildUpgradeReplayReport(workspace, hostName) {
  const session = readLatestUpgradeSession(workspace, hostName);
  const current = readFileSync(workspace.profileDocPath, 'utf8');
  const baseline = readFileSync(session.targetPath, 'utf8');
  const drift = normalizeNewlines(current) !== normalizeNewlines(baseline);

  return {
    ok: !drift,
    drift: drift ? [path.relative(workspace.repoRoot, workspace.profileDocPath)] : [],
    session,
  };
}
```

```javascript
function handleUpgrade(workspace, flags, positional) {
  const action = positional[0] || 'apply';

  if (action === 'apply') {
    return handleUpgradeApply(workspace, flags, positional.slice(1));
  }
  if (action === 'sync') {
    return handleUpgradeSync(workspace, flags, positional.slice(1));
  }
  if (action === 'replay') {
    return handleUpgradeReplay(workspace, flags, positional.slice(1));
  }

  return handleUpgradeApply(workspace, flags, positional);
}

function handleUpgradeApply(workspace, flags, positional) {
  const report = buildUpgradeApplyReport(workspace, normalizeHostName(flags.host || workspace.activeHostName));
  writeUpgradeSession(workspace, report);
  console.log(renderUpgradeApplyReport(report));
  if (!report.ok) {
    process.exit(1);
  }
}
```

- [ ] **Step 4: Add thin wrappers and document the commands**

```javascript
#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agent-system.mjs');
const result = spawnSync(process.execPath, [cli, 'upgrade', 'replay', ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
```

- [ ] **Step 5: Verify the split upgrade flow**

```bash
node --test tests/upgrade-cli.test.mjs
node ./bin/agent-system.mjs upgrade apply --host qwen
node ./bin/agent-system.mjs upgrade replay --host qwen
```

### Task 3: Add brain hygiene, dedupe, and executable query/backup wrappers

**Files:**
- Create: `lib/brain-hygiene.mjs`
- Create: `bin/brain-query.mjs`
- Create: `bin/brain-dedupe.mjs`
- Create: `bin/backup-validate.mjs`
- Modify: `bin/agent-system.mjs`
- Modify: `tests/brain-cli.test.mjs`
- Modify: `tests/backup-restore-cli.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
test('brain dedupe reports merge candidates for similar notes', () => {
  const workspace = createWorkspace();
  try {
    runAgent(['brain', 'add', '--host', 'qwen', '--scope', 'host:qwen', '--title', 'Route fallback lesson', 'Keep route fallback deterministic.'], workspace);
    runAgent(['brain', 'add', '--host', 'qwen', '--scope', 'host:qwen', '--title', 'Route fallback rule', 'Keep route fallback deterministic.'], workspace);

    const dedupe = runAgent(['brain', 'dedupe', '--scope', 'host:qwen'], workspace);
    assert.equal(dedupe.status, 0, dedupe.stderr);
    assert.match(dedupe.stdout, /\[BRAIN DEDUPE\]/);
    assert.match(dedupe.stdout, /Merge candidates:/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/brain-cli.test.mjs`

Expected: FAIL because `brain dedupe` does not exist yet and the note similarity audit is not implemented.

- [ ] **Step 3: Implement the brain hygiene helpers and wrappers**

```javascript
export function findBrainMergeCandidates(entries) {
  const pairs = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const left = normalizeBrainEntry(entries[i]);
      const right = normalizeBrainEntry(entries[j]);
      if (left.scope !== right.scope) continue;
      if (left.sourcePath && left.sourcePath === right.sourcePath) {
        pairs.push({ left, right, reason: 'shared sourcePath' });
        continue;
      }
      if (similarTitle(left.title, right.title) && left.summary === right.summary) {
        pairs.push({ left, right, reason: 'similar title and summary' });
      }
    }
  }
  return pairs;
}
```

```javascript
function handleBrain(workspace, flags, positional) {
  const action = positional[0] || 'query';
  if (action === 'dedupe') {
    return handleBrainDedupe(workspace, flags, positional.slice(1));
  }
  return handleBrainQuery(workspace, flags, positional.slice(1));
}
```

- [ ] **Step 4: Verify the hygiene flow and commit**

```bash
node --test tests/brain-cli.test.mjs
node --test tests/backup-restore-cli.test.mjs
node ./bin/brain-query.mjs fallback
node ./bin/backup-validate.mjs ./agent-system-backup.json
```

### Task 4: Update the release docs, versioning, and final gates

**Files:**
- Modify: `package.json`
- Modify: `agent-system.json`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/upgrade/README.md`
- Modify: `docs/baselines/agent-system.mjs.md`
- Modify: `commands/gate.md`
- Modify: `commands/lock.md`
- Modify: `commands/handoff.md`
- Modify: `commands/profile.md`
- Modify: `commands/route.md`
- Modify: `commands/upgrade-apply.md`
- Modify: `commands/upgrade-sync.md`
- Modify: `commands/upgrade-replay.md`
- Modify: `commands/brain-dedupe.md`
- Modify: `commands/delivery-check.md`
- Test: `tests/surface-contract.test.mjs`

- [ ] **Step 1: Write the failing surface-contract test**

```javascript
test('release surface includes executable enforcement wrappers and version 0.6.4', () => {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

  assert.equal(pkg.version, '0.6.4');
  assert.equal(existsSync(path.join(repoRoot, 'bin', 'delivery-check.mjs')), true);
  assert.equal(existsSync(path.join(repoRoot, 'bin', 'upgrade-apply.mjs')), true);
  assert.equal(existsSync(path.join(repoRoot, 'bin', 'upgrade-sync.mjs')), true);
  assert.equal(existsSync(path.join(repoRoot, 'bin', 'upgrade-replay.mjs')), true);
  assert.equal(existsSync(path.join(repoRoot, 'bin', 'brain-query.mjs')), true);
  assert.equal(existsSync(path.join(repoRoot, 'bin', 'brain-dedupe.mjs')), true);
  assert.equal(existsSync(path.join(repoRoot, 'bin', 'backup-validate.mjs')), true);
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'upgrade-apply.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'upgrade-sync.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'upgrade-replay.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'brain-dedupe.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'delivery-check.md')), true);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/surface-contract.test.mjs`

Expected: FAIL because the version, docs, and wrappers still point at the 0.6.1 surface.

- [ ] **Step 3: Update the release docs and command docs to match the enforcement surface**

```markdown
## V0.6.4 intent

This release moves the critical delivery flows from markdown-only contracts to executable enforcement paths. Upgrade replay becomes drift-aware, delivery checks fail closed on missing artifacts, and brain hygiene gains a deterministic dedupe path.
```

```markdown
# /upgrade apply

Run the upgrade application path for the current target and create or refresh the upgrade session snapshot.

Return:

    [UPGRADE APPLY]
    Target:
    Session:
    Hosts synced:
    Artifacts checked:
    Blocked / Ready:
```

- [ ] **Step 4: Run the full repo verification set**

```bash
node --test
node ./bin/agent-system.mjs validate
node ./bin/agent-system.mjs lint
```

- [ ] **Step 5: Commit and push the release**

```bash
git add .
git commit -m "feat: ship agent-system 0.6.4 enforcement"
git push origin feat/agent-system-0.6.4
```
