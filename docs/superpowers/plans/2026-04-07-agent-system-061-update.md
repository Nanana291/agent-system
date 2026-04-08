# agent-system 0.6.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver `0.6.1` as a stability-and-memory release that tightens validation, improves brain and memory quality, and makes command output clearer without changing the core command model.

**Architecture:** Keep the work concentrated in the CLI entrypoint and the existing schema/docs files. First align the versioned contract and release notes, then harden validation and materialization paths, then adjust memory and brain quality heuristics, and finally update tests and baseline docs so the observable behavior is locked down.

**Tech Stack:** Node.js ESM CLI, JSON/JSONL file formats, markdown docs, Node test runner.

---

### Task 1: Lock the 0.6.1 release contract

**Files:**
- Modify: `package.json`
- Modify: `agent-system.json`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/brain/README.md`
- Modify: `docs/memory-schema.md`
- Modify: `docs/training/README.md`
- Modify: `docs/baselines/agent-system.mjs.md`

- [ ] **Step 1: Capture the current release state in the versioned metadata**

```json
{
  "version": "0.6.1"
}
```

- [ ] **Step 2: Rewrite the release notes to describe the stabilized brain/memory scope**

```markdown
## V0.6.1 intent

This release keeps the structured brain, host memory, training, and recovery layers intact while tightening validation, reducing memory noise, and making command output more explicit.
```

- [ ] **Step 3: Refresh the baseline note so it names the new observable behavior**

```markdown
- `validate` should report clearer missing-file and mismatch output across manifest, profile, brain, memory, training, eval, and status paths.
- `memory review`, `memory compress`, `memory teach`, `memory gate`, `memory prune`, and `memory learn` should stay host-local while filtering weaker rules more conservatively.
- `brain add`, `brain query`, `brain explain`, `brain promote`, `brain demote`, `brain prune`, `brain snapshot`, `brain restore`, `brain diff`, and `brain sync` should preserve the current materialized brain while producing clearer summary output.
```

- [ ] **Step 4: Run a repository validation pass after metadata changes**

```bash
node ./bin/agent-system.mjs validate
```

- [ ] **Step 5: Commit the contract update**

```bash
git add package.json agent-system.json README.md AGENTS.md docs/brain/README.md docs/memory-schema.md docs/training/README.md docs/baselines/agent-system.mjs.md
git commit -m "docs: prepare 0.6.1 release contract"
```

### Task 2: Harden validation and brain materialization

**Files:**
- Modify: `bin/agent-system.mjs`
- Test: `tests/brain-cli.test.mjs`
- Test: `tests/train-cli.test.mjs`

- [ ] **Step 1: Add failing coverage for clearer validation and brain output**

```javascript
assert.match(result.stdout, /Validation: FAILED/);
assert.match(result.stdout, /missing/);
assert.match(query.stdout, /\[BRAIN QUERY\]/);
assert.match(query.stdout, /Hits:/);
```

- [ ] **Step 2: Make validation output group missing paths and keep the same exit contract**

```javascript
console.log('Validation: FAILED');
for (const issue of issues) {
  console.log(`- ${issue}`);
}
process.exit(1);
```

- [ ] **Step 3: Ensure brain materialization stays stable when entries are re-read from history**

```javascript
function materializeBrainCurrent(workspace) {
  const history = readBrainHistory(workspace);
  if (history.length === 0) {
    const current = readBrainCurrent(workspace);
    return current.entries.length > 0 ? buildBrainState(workspace, current.entries) : current;
  }
  // merge by brainId and rebuild a clean current snapshot
}
```

- [ ] **Step 4: Tighten brain pruning so duplicates are removed by the normalized entry shape**

```javascript
const key = [
  normalized.brainId,
  normalized.status,
  normalizeNewlines(normalized.summary),
  normalizeNewlines(normalized.evidence),
  normalized.source,
].join('|');
```

- [ ] **Step 5: Verify the brain and train suites still pass**

```bash
node --test tests/brain-cli.test.mjs
node --test tests/train-cli.test.mjs
```

### Task 3: Improve memory quality and host-local filtering

**Files:**
- Modify: `bin/agent-system.mjs`
- Test: `tests/memory-refinement-cli.test.mjs`

- [ ] **Step 1: Add coverage for stronger host-local review and gate summaries**

```javascript
assert.match(result.stdout, /Duplicate lessons:/);
assert.match(result.stdout, /Compression candidates:/);
assert.match(gate.stdout, /Ready:/);
assert.match(gate.stdout, /Demoted:/);
```

- [ ] **Step 2: Make review/compress/teach/gate prune weak notes more conservatively**

```javascript
if (text.length < 20 || /maybe|todo|temp|unclear/i.test(text)) {
  weak += 1;
}
```

- [ ] **Step 3: Keep `memory learn` and `memory gate` aligned with the host snapshot flow**

```javascript
if (report.applied && report.promoted > 0) {
  saveLearningSnapshot(workspace.repoRoot, hostName, 'memory-learn');
}
captureBrainFromMemory(workspace, hostName, 'learn', `Learned ${report.promoted} lessons for ${hostName}; applied=${report.applied ? 'yes' : 'no'}.`, report.promoted > 0);
```

- [ ] **Step 4: Verify memory refinement behavior**

```bash
node --test tests/memory-refinement-cli.test.mjs
```

### Task 4: Final verification and release

**Files:**
- Modify: any files needed for final fixes from verification

- [ ] **Step 1: Run the full focused test suite**

```bash
node --test tests/brain-cli.test.mjs tests/memory-refinement-cli.test.mjs tests/train-cli.test.mjs tests/change-cli.test.mjs tests/status-cli.test.mjs tests/upgrade-cli.test.mjs tests/backup-restore-cli.test.mjs tests/quick-update-cli.test.mjs tests/quick-fix-cli.test.mjs tests/luau-quick-cli.test.mjs tests/luau-learning-loop.test.mjs tests/luau-auto-repair-cli.test.mjs tests/learning-recovery-cli.test.mjs tests/eval-cli.test.mjs
```

- [ ] **Step 2: Run repo validation and lint**

```bash
node ./bin/agent-system.mjs validate
node ./bin/agent-system.mjs lint
```

- [ ] **Step 3: Commit and push the release**

```bash
git add .
git commit -m "feat: release agent-system 0.6.1"
git push origin main
```
