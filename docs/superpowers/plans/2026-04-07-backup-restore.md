# Backup Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a validated backup and restore layer that can snapshot and recover the full mutable state of `agent-system` without relying on git history alone.

**Architecture:** Build backup and restore on top of the existing JSON bundle shape already used by export/import, but extend it to capture the whole mutable workspace: manifest, package metadata, release docs, active profiles, host-scoped memory, status, change state, and baseline docs. `backup` will write a portable bundle, `restore` will write that bundle back into the repo, and `bundle validate` / `bundle diff` / `bundle prune` will keep the recovery path safe and inspectable.

**Tech Stack:** Node.js CLI, JSON bundles, markdown workspace docs, existing `memory/`, `status/`, `change/`, `profiles/`, and `docs/baselines/` layout, `node:test`.

---

### Task 1: Add failing tests for backup, restore, and bundle safety commands

**Files:**
- Create: `tests/backup-restore-cli.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'bin', 'agent-system.mjs');

function createWorkspace() {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-backup-'));
  cpSync(path.join(repoRoot, 'agent-system.json'), path.join(dir, 'agent-system.json'));
  cpSync(path.join(repoRoot, 'package.json'), path.join(dir, 'package.json'));
  cpSync(path.join(repoRoot, 'bin'), path.join(dir, 'bin'), { recursive: true });
  cpSync(path.join(repoRoot, 'docs'), path.join(dir, 'docs'), { recursive: true });
  cpSync(path.join(repoRoot, 'memory'), path.join(dir, 'memory'), { recursive: true });
  cpSync(path.join(repoRoot, 'profiles'), path.join(dir, 'profiles'), { recursive: true });
  cpSync(path.join(repoRoot, 'templates'), path.join(dir, 'templates'), { recursive: true });
  cpSync(path.join(repoRoot, 'README.md'), path.join(dir, 'README.md'));
  cpSync(path.join(repoRoot, 'AGENTS.md'), path.join(dir, 'AGENTS.md'));
  cpSync(path.join(repoRoot, 'status'), path.join(dir, 'status'), { recursive: true });
  cpSync(path.join(repoRoot, 'change'), path.join(dir, 'change'), { recursive: true });
  return dir;
}

function runAgent(args, cwd) {
  return spawnSync('node', [cli, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

test('backup creates a full mutable-state bundle with explicit host metadata', () => {
  const workspace = createWorkspace();
  try {
    const bundlePath = path.join(workspace, 'qwen-backup.json');
    const result = runAgent(['backup', '--profile', 'imphub', '--host', 'qwen', bundlePath], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Backed up imphub to/);
    assert.equal(existsSync(bundlePath), true);

    const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
    assert.equal(bundle.kind, 'agent-system-backup');
    assert.equal(bundle.backupVersion, 1);
    assert.equal(bundle.activeProfile, 'imphub');
    assert.equal(bundle.activeHost, 'qwen');
    assert.equal(typeof bundle.files['agent-system.json'], 'object');
    assert.equal(typeof bundle.files['package.json'], 'object');
    assert.equal(typeof bundle.files['README.md'], 'string');
    assert.equal(typeof bundle.files['AGENTS.md'], 'string');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('bundle validate rejects incomplete snapshots and bundle diff reports differences', () => {
  const workspace = createWorkspace();
  try {
    const bundlePath = path.join(workspace, 'broken-snapshot.json');
    writeFileSync(bundlePath, JSON.stringify({ kind: 'agent-system-backup', backupVersion: 1 }, null, 2) + '\n', 'utf8');

    const validate = runAgent(['bundle', 'validate', '--file', bundlePath], workspace);
    assert.notEqual(validate.status, 0);
    assert.match(validate.stdout, /\[BUNDLE VALIDATE\]/);
    assert.match(validate.stdout, /Ready: no/);

    const diff = runAgent(['bundle', 'diff', '--file', bundlePath], workspace);
    assert.equal(diff.status, 0, diff.stderr);
    assert.match(diff.stdout, /\[BUNDLE DIFF\]/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('bundle prune removes duplicate noise from the snapshot', () => {
  const workspace = createWorkspace();
  try {
    const bundlePath = path.join(workspace, 'prune-snapshot.json');
    const backup = runAgent(['backup', '--profile', 'imphub', '--host', 'qwen', bundlePath], workspace);
    assert.equal(backup.status, 0, backup.stderr);

    const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
    bundle.memory.change = '# Qwen Change Memory\n\n- Keep host memory flat.\n- Keep host memory flat.\n';
    writeFileSync(bundlePath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');

    const prune = runAgent(['bundle', 'prune', '--file', bundlePath], workspace);
    assert.equal(prune.status, 0, prune.stderr);
    assert.match(prune.stdout, /\[BUNDLE PRUNE\]/);

    const pruned = JSON.parse(readFileSync(bundlePath, 'utf8'));
    assert.match(pruned.memory.change, /Keep host memory flat\./);
    assert.equal((pruned.memory.change.match(/Keep host memory flat\./g) || []).length, 1);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('restore round-trips a backup bundle into a clean workspace', () => {
  const workspace = createWorkspace();
  try {
    const bundlePath = path.join(workspace, 'agent-system-backup.json');
    const backup = runAgent(['backup', '--profile', 'imphub', '--host', 'qwen', bundlePath], workspace);

    assert.equal(backup.status, 0, backup.stderr);

    const restore = runAgent(['restore', '--file', bundlePath], workspace);
    assert.equal(restore.status, 0, restore.stderr);
    assert.match(restore.stdout, /Restored imphub/);
    assert.equal(existsSync(path.join(workspace, 'memory', 'host', 'qwen.md')), true);
    assert.equal(existsSync(path.join(workspace, 'status', 'current.json')), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the new test file and confirm it fails**

Run: `node --test tests/backup-restore-cli.test.mjs`

Expected: fail with `Unknown command: backup` and `Unknown command: bundle` before implementation.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/backup-restore-cli.test.mjs
git commit -m "test: cover backup restore workflow"
```

### Task 2: Implement `backup`, `restore`, and `bundle` commands in the CLI

**Files:**
- Modify: `bin/agent-system.mjs`
- Modify: `agent-system.json`
- Modify: `package.json`

- [ ] **Step 1: Add the new command routing and flags**

```js
if (arg === '--file') {
  flags.file = argv[i + 1];
  i += 1;
  continue;
}
```

```js
case 'backup':
  handleBackup(workspace, flags, positional);
  return;
case 'restore':
  handleRestore(workspace, flags, positional);
  return;
case 'bundle':
  handleBundle(workspace, flags, positional);
  return;
```

- [ ] **Step 2: Implement bundle helpers for backup, restore, validate, diff, and prune**

```js
function handleBackup(workspace, flags, positional) {
  const profileName = flags.profile || workspace.activeProfileName;
  const outputPath = positional[0] || path.join(workspace.repoRoot, `${profileName}-backup.json`);
  const bundle = buildBackupBundle(workspace, profileName);
  fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
  console.log(`Backed up ${profileName} to ${outputPath}`);
}
```

```js
function handleRestore(workspace, flags, positional) {
  const inputPath = flags.file || positional[0];
  if (!inputPath) {
    console.error('Usage: agent-system restore --file <backup.json>');
    process.exit(1);
  }
  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.resolve(workspace.repoRoot, inputPath);
  const bundle = readJson(absolutePath);
  const validation = validateBackupBundle(bundle);
  if (!validation.ok) {
    console.error(validation.issues.join('\n'));
    process.exit(1);
  }
  restoreBackupBundle(workspace.repoRoot, bundle);
  const restoredWorkspace = loadWorkspace(bundle.profile?.profile, bundle.activeHost);
  const postRestore = buildLintReport(restoredWorkspace);
  if (!postRestore.ok) {
    console.error(postRestore.items.join('\n'));
    process.exit(1);
  }
  console.log(`Restored ${bundle.profile?.profile || bundle.profile?.name || 'imported-profile'}`);
}
```

```js
function handleImport(workspace, flags, positional) {
  const inputPath = flags.file || flags.files?.[0] || positional[0];
  if (!inputPath) {
    console.error('Usage: agent-system import --file <bundle.json>');
    process.exit(1);
  }
  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.resolve(workspace.repoRoot, inputPath);
  const bundle = readJson(absolutePath);
  const imported = importBundle(workspace.repoRoot, bundle);
  console.log(`Imported ${imported.profileName}`);
}
```

```js
function handleBundle(workspace, flags, positional) {
  const action = positional[0] || 'validate';
  const inputPath = flags.file || positional[1];
  if (!inputPath) {
    console.error('Usage: agent-system bundle <validate|diff|prune> --file <backup.json>');
    process.exit(1);
  }
  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.resolve(workspace.repoRoot, inputPath);
  const bundle = readJson(absolutePath);
  if (action === 'validate') {
    const report = validateBackupBundle(bundle);
    console.log('[BUNDLE VALIDATE]');
    console.log(`Ready: ${report.ok ? 'yes' : 'no'}`);
    for (const issue of report.issues) {
      console.log(`- ${issue}`);
    }
    process.exit(report.ok ? 0 : 1);
  }
  if (action === 'diff') {
    const report = diffBackupBundle(workspace.repoRoot, bundle);
    console.log('[BUNDLE DIFF]');
    for (const line of report.lines) {
      console.log(line);
    }
    return;
  }
  if (action === 'prune') {
    const report = pruneBackupBundle(bundle);
    fs.writeFileSync(absolutePath, JSON.stringify(report.bundle, null, 2) + '\n', 'utf8');
    console.log('[BUNDLE PRUNE]');
    console.log(`Pruned: ${report.pruned}`);
    return;
  }
  console.error(`Unknown bundle action: ${action}`);
  process.exit(1);
}
```

```js
function buildBackupBundle(workspace, profileName) {
  const bundle = buildExportBundle(workspace, profileName);
  return {
    ...bundle,
    kind: 'agent-system-backup',
    backupVersion: 1,
    activeProfile: profileName,
    activeHost: workspace.activeHostName,
    change: {
      current: readOptionalText(workspace.changeCurrentPath),
      history: readOptionalText(workspace.changeHistoryPath),
    },
    files: {
      'agent-system.json': readJson(path.join(workspace.repoRoot, 'agent-system.json')),
      'package.json': readJson(path.join(workspace.repoRoot, 'package.json')),
      'README.md': readOptionalText(path.join(workspace.repoRoot, 'README.md')),
      'AGENTS.md': readOptionalText(path.join(workspace.repoRoot, 'AGENTS.md')),
      'docs/baselines/agent-system.mjs.md': readOptionalText(path.join(workspace.repoRoot, 'docs/baselines/agent-system.mjs.md')),
    },
  };
}
```

```js
function validateBackupBundle(bundle) {
  const issues = [];
  if (!bundle || bundle.kind !== 'agent-system-backup') issues.push('missing backup kind');
  if (!bundle.profile?.profile) issues.push('missing active profile');
  if (!bundle.activeHost) issues.push('missing active host');
  if (!bundle.manifest) issues.push('missing manifest');
  if (!bundle.change?.current) issues.push('missing change current');
  if (!bundle.change?.history) issues.push('missing change history');
  if (!bundle.memory?.packs) issues.push('missing host pack memory');
  if (!bundle.files?.['agent-system.json']) issues.push('missing agent-system.json');
  if (!bundle.files?.['package.json']) issues.push('missing package.json');
  if (!bundle.files?.['README.md']) issues.push('missing README.md');
  if (!bundle.files?.['AGENTS.md']) issues.push('missing AGENTS.md');
  if (!bundle.files?.['docs/baselines/agent-system.mjs.md']) issues.push('missing docs/baselines/agent-system.mjs.md');
  return { ok: issues.length === 0, issues };
}
```

```js
function diffBackupBundle(repoRoot, bundle) {
  const workspace = loadWorkspace(bundle.profile?.profile || 'imphub', bundle.activeHost || 'qwen');
  const current = buildBackupBundle(workspace, workspace.activeProfileName);
  const lines = [];
  const compare = [
    ['active profile', current.activeProfile, bundle.activeProfile],
    ['active host', current.activeHost, bundle.activeHost],
    ['change current', current.change?.current, bundle.change?.current],
    ['change history', current.change?.history, bundle.change?.history],
    ['host pack', current.memory?.packs, bundle.memory?.packs],
  ];
  for (const [label, currentValue, nextValue] of compare) {
    if (normalizeNewlines(String(currentValue || '')) !== normalizeNewlines(String(nextValue || ''))) {
      lines.push(`- ${label} differs`);
    }
  }
  for (const key of Object.keys(bundle.files || {})) {
    const currentValue = current.files?.[key];
    const nextValue = bundle.files?.[key];
    if (JSON.stringify(currentValue) !== JSON.stringify(nextValue)) {
      lines.push(`- file differs: ${key}`);
    }
  }
  return { lines: lines.length > 0 ? lines : ['- no differences'] };
}
```

```js
function pruneBackupBundle(bundle) {
  const next = structuredCloneSafe(bundle);
  let pruned = 0;
  const pruneText = (text) => {
    const lines = String(text || '').split(/\r?\n/);
    const seen = new Set();
    const kept = [];
    for (const line of lines) {
      const normalized = line.trim();
      if (!normalized) {
        kept.push(line);
        continue;
      }
      if (normalized.startsWith('- ')) {
        const key = normalized.toLowerCase();
        if (seen.has(key)) {
          pruned += 1;
          continue;
        }
        seen.add(key);
      }
      kept.push(line);
    }
    return `${kept.join('\n').trimEnd()}\n`;
  };
  if (next.memory?.change) next.memory.change = pruneText(next.memory.change);
  if (next.memory?.packs) next.memory.packs = pruneText(next.memory.packs);
  for (const host of Object.keys(next.memory?.host || {})) {
    if (next.memory.host[host]) {
      next.memory.host[host] = pruneText(next.memory.host[host]);
    }
  }
  if (next.change?.history) next.change.history = pruneText(next.change.history);
  return { bundle: next, pruned };
}
```

- [ ] **Step 3: Wire restore writing to the authoritative repo paths**

```js
function restoreBackupBundle(repoRoot, bundle) {
  writeJson(path.join(repoRoot, 'agent-system.json'), bundle.files['agent-system.json']);
  writeJson(path.join(repoRoot, 'package.json'), bundle.files['package.json']);
  writeOptionalText(path.join(repoRoot, 'README.md'), bundle.files['README.md']);
  writeOptionalText(path.join(repoRoot, 'AGENTS.md'), bundle.files['AGENTS.md']);
  writeOptionalText(path.join(repoRoot, 'docs/baselines/agent-system.mjs.md'), bundle.files['docs/baselines/agent-system.mjs.md']);
  writeJson(path.join(repoRoot, bundle.profile?.sourceOfTruth?.structured || `profiles/${bundle.profile.profile}/profile.json`), bundle.profile);
  writeOptionalText(path.join(repoRoot, bundle.profile?.sourceOfTruth?.human || `profiles/${bundle.profile.profile}/AGENTS.md`), bundle.profileDoc);
  writeOptionalText(path.join(repoRoot, bundle.manifest?.memory?.system || 'memory/system.md'), bundle.memory?.system);
  writeOptionalText(path.join(repoRoot, bundle.profile?.memory?.profileMemory || `memory/profile/${bundle.profile.profile}.md`), bundle.memory?.profile);
  writeOptionalText(path.join(repoRoot, bundle.manifest?.memory?.change || `memory/change/${bundle.activeHost}.md`), bundle.memory?.change);
  writeOptionalText(path.join(repoRoot, bundle.manifest?.memory?.packs || `memory/packs/${bundle.activeHost}.md`), bundle.memory?.packs);
  for (const [host, text] of Object.entries(bundle.memory?.host || {})) {
    if (text) {
      const hostPath = path.join(repoRoot, bundle.manifest?.memory?.host?.[host] || `memory/host/${host}.md`);
      writeOptionalText(hostPath, text);
    }
  }
  writeOptionalText(path.join(repoRoot, bundle.manifest?.change?.current || 'change/current.json'), bundle.change?.current);
  writeOptionalText(path.join(repoRoot, bundle.manifest?.change?.history || 'change/history.jsonl'), bundle.change?.history);
  writeOptionalText(path.join(repoRoot, bundle.manifest?.status?.current || 'status/current.json'), bundle.status?.current);
  writeOptionalText(path.join(repoRoot, bundle.manifest?.status?.events || 'status/events.jsonl'), bundle.status?.events);
}
```

- [ ] **Step 4: Add the backup manifest contract and release scripts**

```json
{
  "version": "0.5.0",
  "backup": {
    "schema": "docs/backup-schema.md",
    "defaultOutput": "<profile>-backup.json"
  }
}
```

```json
{
  "memory": {
    "system": "memory/system.md",
    "profile": "memory/profile/<profile>.md",
    "change": "memory/change/<host>.md",
    "packs": "memory/packs/<host>.md",
    "host": {
      "generic": "memory/host/generic.md",
      "claude": "memory/host/claude.md",
      "codex": "memory/host/codex.md",
      "qwen": "memory/host/qwen.md"
    }
  }
}
```

```json
{
  "scripts": {
    "backup": "node ./bin/agent-system.mjs backup",
    "restore": "node ./bin/agent-system.mjs restore",
    "bundle-validate": "node ./bin/agent-system.mjs bundle validate",
    "bundle-diff": "node ./bin/agent-system.mjs bundle diff",
    "bundle-prune": "node ./bin/agent-system.mjs bundle prune"
  }
}
```

- [ ] **Step 5: Run the CLI tests and make sure they pass**

Run:
```bash
node --test tests/backup-restore-cli.test.mjs
node --test tests/change-cli.test.mjs tests/status-cli.test.mjs
node ./bin/agent-system.mjs validate
node ./bin/agent-system.mjs lint
```

Expected: backup/restore commands are functional, bundle validation fails closed on malformed input, and the existing CLI baseline still passes.

- [ ] **Step 6: Commit the runtime changes**

```bash
git add bin/agent-system.mjs agent-system.json package.json
git commit -m "feat: add backup restore bundle commands"
```

### Task 3: Update docs, schema, and baseline for the recovery workflow

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/baselines/agent-system.mjs.md`
- Create: `docs/backup-schema.md`

- [ ] **Step 1: Document the recovery workflow in the README and AGENTS guide**

```md
## Recovery

node ./bin/agent-system.mjs backup --profile imphub ./imphub-backup.json
node ./bin/agent-system.mjs bundle validate --file ./imphub-backup.json
node ./bin/agent-system.mjs bundle diff --file ./imphub-backup.json
node ./bin/agent-system.mjs restore --file ./imphub-backup.json
```

- [ ] **Step 2: Refresh the CLI baseline for `bin/agent-system.mjs`**

```md
## Current Baseline Notes

- `validate` checks the active profile, status files, change files, host memory layout, and backup contract.
- `lint` enforces manifest consistency, memory drift checks, status presence, change presence, pack presence, and backup schema presence.
- `backup` captures the mutable repo state into a portable bundle.
- `restore` writes a validated bundle back into the repo and then runs repo validation.
- `bundle` owns validate, diff, and prune for snapshots.
```

```md
## Verification Targets

- `node ./bin/agent-system.mjs validate`
- `node ./bin/agent-system.mjs lint`
- `node --test tests/status-cli.test.mjs`
- `node --test tests/change-cli.test.mjs`
- `node --test tests/backup-restore-cli.test.mjs`
```

- [ ] **Step 3: Define the bundle schema doc**

```md
# Backup Schema

The backup bundle is a JSON snapshot of the mutable agent-system workspace.

Required top-level fields:
- `kind`
- `backupVersion`
- `exportedAt`
- `activeProfile`
- `activeHost`
- `manifest`
- `profile`
- `files`

Required file keys:
- `agent-system.json`
- `package.json`
- `README.md`
- `AGENTS.md`
- `docs/baselines/agent-system.mjs.md`
```

- [ ] **Step 4: Run a docs and manifest verification pass**

Run:
```bash
node ./bin/agent-system.mjs validate
node ./bin/agent-system.mjs lint
git diff --check
```

Expected: the README and AGENTS guide describe the recovery workflow, the baseline reflects the new commands, and the backup schema doc matches the implemented bundle shape.

- [ ] **Step 5: Commit the docs and schema**

```bash
git add README.md AGENTS.md docs/baselines/agent-system.mjs.md docs/backup-schema.md
git commit -m "docs: describe backup restore workflow"
```
