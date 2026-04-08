# Upgrade Learning Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver `0.6.3` as a learning-aware `/upgrade` release that stops behaving like a passive sync and instead learns per agent, persists upgrade history, replays prior upgrades, and reports what each agent absorbed.

**Architecture:** Keep the work centered in the existing Node.js CLI, but split upgrade into explicit phases with durable state. `preview` inspects the source target, `learn` derives per-agent lessons and writes upgrade history, `apply` materializes learned blocks into docs and memory, `sync` rehydrates the stored upgrade state without new inference, and `report` prints the learned result. The upgrade pipeline should write its own state under `docs/upgrade/` and feed the structured brain so the next run can reuse what was learned. `upgrade` itself remains the compatibility entry point, but its default behavior should execute the learning-aware path instead of a plain sync.

**Tech Stack:** Node.js ESM CLI, JSON/JSONL state files, markdown docs, host-scoped memory files, Node test runner.

---

### Task 1: Lock the 0.6.3 contract and upgrade storage layout

**Files:**
- Modify: `package.json`
- Modify: `agent-system.json`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/baselines/agent-system.mjs.md`
- Create: `docs/upgrade/README.md`

- [ ] **Step 1: Bump the versioned contract to 0.6.3**

```json
{
  "version": "0.6.3"
}
```

- [ ] **Step 2: Add a dedicated upgrade storage layout to the manifest**

```json
{
  "paths": {
    "upgrade": "docs/upgrade"
  },
  "upgrade": {
    "current": "docs/upgrade/current.json",
    "history": "docs/upgrade/history.jsonl",
    "readme": "docs/upgrade/README.md",
    "sessions": "docs/upgrade/sessions"
  }
}
```

- [ ] **Step 3: Rewrite the release notes and baseline notes to describe the new learning pipeline**

```markdown
## V0.6.3 intent

This release turns `/upgrade` into a learning-aware pipeline that previews, learns, applies, syncs, and reports per-agent lessons while keeping the profile and host memories synchronized.
```

```markdown
- `upgrade preview`, `upgrade learn`, `upgrade apply`, `upgrade sync`, `upgrade report`, and `upgrade replay` should expose the upgrade pipeline as explicit phases.
- `upgrade` should learn per-agent lessons, dedupe against prior upgrade history, and sync the learned result into docs and memory.
- `docs/upgrade/current.json`, `docs/upgrade/history.jsonl`, and `docs/upgrade/sessions/<session>.md` should record the upgrade learning trail.
```

- [ ] **Step 4: Add the upgrade docs readme so the new storage is discoverable**

```markdown
# Upgrade Log

- `current.json` holds the latest upgrade learning state.
- `history.jsonl` stores append-only upgrade runs.
- `sessions/<session>.md` stores one human-readable report per upgrade.
```

- [ ] **Step 5: Run a validation pass after the contract changes**

```bash
node ./bin/agent-system.mjs validate
```

### Task 2: Rebuild `/upgrade` as a learning pipeline

**Files:**
- Modify: `bin/agent-system.mjs`
- Test: `tests/upgrade-cli.test.mjs`
- Test: `tests/status-cli.test.mjs` if the upgrade report reuses status output helpers

- [ ] **Step 1: Add failing tests for per-agent learning and the new upgrade phases**

```javascript
assert.match(preview.stdout, /\[UPGRADE PREVIEW\]/);
assert.match(learn.stdout, /\[UPGRADE LEARN\]/);
assert.match(report.stdout, /\[UPGRADE REPORT\]/);
assert.match(replay.stdout, /\[UPGRADE REPLAY\]/);
assert.equal(readFileSync(path.join(workspace, 'docs', 'upgrade', 'current.json'), 'utf8').includes('agent-system-upgrade'), true);
```

- [ ] **Step 2: Add a durable upgrade state model with per-agent lesson records**

```javascript
function buildUpgradeLearningReport(workspace, sourceText, targetPath, activeHost) {
  return {
    kind: 'agent-system-upgrade',
    version: 1,
    mode,
    activeProfile: workspace.activeProfileName,
    activeHost,
    targetPath,
    agents: [
      {
        title: 'Scriptmaster',
        key: 'scriptmaster',
        lesson: 'Keep selector ownership explicit.',
        evidence: '## Agent 1 — The Scriptmaster',
        status: 'new',
        confidence: 82,
      },
    ],
    hosts: ['claude', 'codex', 'qwen'],
  };
}
```

- [ ] **Step 3: Split upgrade handling into explicit phases and keep the old path as a compatibility alias**

```javascript
switch (action) {
  case 'preview':
    return handleUpgradePreview(workspace, flags, positional);
  case 'learn':
    return handleUpgradeLearn(workspace, flags, positional);
  case 'apply':
    return handleUpgradeApply(workspace, flags, positional);
  case 'sync':
    return handleUpgradeSync(workspace, flags, positional);
  case 'report':
    return handleUpgradeReport(workspace, flags, positional);
  case 'replay':
    return handleUpgradeReplay(workspace, flags, positional);
  default:
    return handleUpgradeApply(workspace, flags, positional);
}
```

- [ ] **Step 4: Persist and replay the upgrade history**

```javascript
function writeUpgradeLearningRecord(workspace, report) {
  fs.mkdirSync(workspace.upgradeDir, { recursive: true });
  fs.writeFileSync(workspace.upgradeCurrentPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  fs.appendFileSync(workspace.upgradeHistoryPath, JSON.stringify({
    ...report,
    eventType: report.mode,
    recordedAt: report.generatedAt,
  }) + '\n', 'utf8');
}
```

- [ ] **Step 5: Reuse the learned upgrade state for apply, sync, and report**

```javascript
function syncUpgradeState(workspace) {
  const current = readUpgradeCurrent(workspace);
  if (!current) {
    throw new Error('upgrade state missing');
  }
  return applyUpgradeState(workspace, current, { replay: false });
}
```

- [ ] **Step 6: Feed the structured brain with agent-level upgrade facts**

```javascript
appendBrainEvent(workspace, {
  source: 'upgrade',
  scope: `profile:${workspace.activeProfileName}`,
  status: 'active',
  title: `${workspace.activeProfileName} upgrade learning`,
  facts: report.agents.map((agent) => `${agent.title}: ${agent.lesson}`),
});
```

- [ ] **Step 7: Verify the upgrade suite and the core CLI still pass**

```bash
node --test tests/upgrade-cli.test.mjs
node --test tests/status-cli.test.mjs
```

### Task 3: Expand the slash-command surface and documentation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `commands/upgrade.md`
- Create: `commands/upgrade-learn.md`
- Create: `commands/upgrade-report.md`
- Create: `commands/upgrade-replay.md`
- Create: `commands/upgrade-sync.md`
- Modify: `docs/baselines/agent-system.mjs.md`

- [ ] **Step 1: Add new slash docs for the learning-aware upgrade phases**

```markdown
---
description: Learn per-agent lessons from the current upgrade target
---

- `upgrade learn` derives per-agent lessons and writes the upgrade learning snapshot
- `upgrade replay` compares a historical upgrade session against the current target
- `upgrade report` summarizes the latest upgrade learning state
- `upgrade sync` rehydrates the stored state without re-inference
```

- [ ] **Step 2: Update the top-level upgrade slash doc to present the pipeline instead of a sync-only command**

```markdown
- `upgrade` runs the full learning-aware pipeline
- `upgrade preview` inspects the target without writing files
- `upgrade learn` computes per-agent lessons
- `upgrade apply` writes the learned sync result
- `upgrade sync` rehydrates stored state
- `upgrade report` prints the current learning state
- `upgrade replay` compares a historical session
```

- [ ] **Step 3: Refresh the human-facing repo docs to mention the new phases**

```markdown
- `upgrade preview`, `upgrade learn`, `upgrade apply`, `upgrade sync`, `upgrade report`, and `upgrade replay` expose the upgrade pipeline as explicit phases.
- `upgrade` now learns per-agent lessons before syncing memory.
```

- [ ] **Step 4: Keep the baseline aligned with the new command surface**

```markdown
- `validate` should cover the upgrade learning files and phase-specific help text.
- `lint` should treat missing upgrade docs or upgrade state files as contract failures.
```

### Task 4: Final verification and release

**Files:**
- Modify: any files needed for fixes found during verification

- [ ] **Step 1: Run the focused upgrade and training suites**

```bash
node --test tests/upgrade-cli.test.mjs
node --test tests/train-cli.test.mjs
```

- [ ] **Step 2: Run repo validation and lint**

```bash
node ./bin/agent-system.mjs validate
node ./bin/agent-system.mjs lint
```

- [ ] **Step 3: Commit and push the 0.6.3 release**

```bash
git add .
git commit -m "feat: release agent-system 0.6.3"
git push origin main
```
