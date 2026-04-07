# Agent Host Memory Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a host-local memory refinement loop that reviews, compresses, teaches, and gates lessons for Claude, Codex, and Qwen without introducing shared memory.

**Architecture:** Keep the host memory model flat. The CLI will read and write only the active host's `memory/change/<host>.md`, `memory/host/<host>.md`, and `memory/packs/<host>.md` files. `change gate` will keep capturing lessons, then the new refinement commands will filter weak entries, compress repeated lessons into stable rules, and generate compact host-specific learning packs.

**Tech Stack:** Node.js CLI, markdown memory files, JSON manifest, existing `change/` and `memory/` workspace layout, `node:test`.

---

### Task 1: Add failing tests for host refinement commands

**Files:**
- Create: `tests/memory-refinement-cli.test.mjs`
- Modify: `tests/change-cli.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
test('memory review and compress stay inside the active host memory', () => {
  const workspace = createWorkspace();
  try {
    writeFileSync(
      path.join(workspace, 'memory', 'change', 'qwen.md'),
      '# Qwen Change Memory\n\n- Gate passed for update change targeting bin/agent-system.mjs.\n- Gate passed for update change targeting bin/agent-system.mjs.\n- Keep host memory flat.\n',
      'utf8',
    );

    const result = runMemory(['review', '--host', 'qwen'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[MEMORY REVIEW\]/);
    assert.match(result.stdout, /Host: qwen/);
    assert.match(result.stdout, /Duplicate lessons:/);
    assert.match(result.stdout, /Compression candidates:/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
```

```js
test('memory teach and memory gate produce a compact host pack', () => {
  const workspace = createWorkspace();
  try {
    writeFileSync(
      path.join(workspace, 'memory', 'change', 'claude.md'),
      '# Claude Change Memory\n\n- Gate passed for update change targeting bin/agent-system.mjs.\n- Use a host-local file for durable lessons.\n',
      'utf8',
    );

    const gate = runMemory(['gate', '--host', 'claude'], workspace);
    assert.equal(gate.status, 0, gate.stderr);
    assert.match(gate.stdout, /\[MEMORY GATE\]/);

    const teach = runMemory(['teach', '--host', 'claude'], workspace);
    assert.equal(teach.status, 0, teach.stderr);
    assert.match(teach.stdout, /\[MEMORY TEACH\]/);
    assert.match(teach.stdout, /memory\/host\/claude\.md/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
```

```js
test('memory packs generate and list stay host-local', () => {
  const workspace = createWorkspace();
  try {
    const generate = runMemory(['packs', 'generate', '--host', 'qwen'], workspace);
    assert.equal(generate.status, 0, generate.stderr);
    assert.match(generate.stdout, /\[LEARNING PACKS\]/);
    assert.match(generate.stdout, /memory\/packs\/qwen\.md/);

    const list = runMemory(['packs', 'list', '--host', 'qwen'], workspace);
    assert.equal(list.status, 0, list.stderr);
    assert.match(list.stdout, /memory\/packs\/qwen\.md/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
```

```js
test('memory reflect records a host-local lesson without crossing hosts', () => {
  const workspace = createWorkspace();
  try {
    const result = runMemory(['reflect', '--host', 'codex'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[MEMORY REFLECT\]/);
    assert.match(result.stdout, /Host: codex/);
    assert.match(result.stdout, /memory\/change\/codex\.md/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `node --test tests/memory-refinement-cli.test.mjs`

Expected: fail with `Unknown memory action: review`, `Unknown memory action: teach`, or `Unknown memory action: packs` before implementation.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/memory-refinement-cli.test.mjs tests/change-cli.test.mjs
git commit -m "test: cover host memory refinement"
```

### Task 2: Implement host review, compression, teaching, and learning packs

**Files:**
- Modify: `bin/agent-system.mjs`
- Modify: `agent-system.json`
- Modify: `package.json`

- [ ] **Step 1: Add the new memory actions to the CLI router**

```js
if (action === 'review') {
  handleMemoryReview(workspace, flags);
  return;
}

if (action === 'compress') {
  handleMemoryCompress(workspace, flags);
  return;
}

if (action === 'teach') {
  handleMemoryTeach(workspace, flags);
  return;
}

if (action === 'gate') {
  handleMemoryGate(workspace, flags);
  return;
}

if (action === 'reflect') {
  handleMemoryReflect(workspace, flags);
  return;
}

if (action === 'packs') {
  handleLearningPacks(workspace, flags, positional.slice(1));
  return;
}
```

- [ ] **Step 2: Implement host-local review and compression helpers**

```js
function handleMemoryReview(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const report = reviewHostMemory(workspace.repoRoot, hostName);
  console.log('[MEMORY REVIEW]');
  console.log(`Host: ${hostName}`);
  console.log(`Weak notes: ${report.weak}`);
  console.log(`Duplicate lessons: ${report.duplicates.length}`);
  console.log(`Compression candidates: ${report.candidates.length}`);
}
```

```js
function handleMemoryTeach(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const report = teachHostMemory(workspace.repoRoot, hostName);
  console.log('[MEMORY TEACH]');
  console.log(`Host: ${hostName}`);
  console.log(`Wrote: ${path.relative(workspace.repoRoot, report.targetPath)}`);
}
```

```js
function handleMemoryReflect(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const report = reflectHostMemory(workspace.repoRoot, hostName);
  console.log('[MEMORY REFLECT]');
  console.log(`Host: ${hostName}`);
  console.log(`Wrote: ${path.relative(workspace.repoRoot, report.targetPath)}`);
}
```

- [ ] **Step 3: Wire `change gate` into host reflection and pack generation**

```js
case 'gate': {
  const intake = readChangeCurrent(workspace);
  const report = evaluateChangeGate(intake);
  captureChangeMemory(workspace, intake, report, workspace.activeHostName);
  recordHostReflection(workspace, intake, report, workspace.activeHostName);
  if (report.ready) {
    learnMemory(workspace.repoRoot, workspace.activeHostName, 2, true);
    teachHostMemory(workspace.repoRoot, workspace.activeHostName);
  }
  writeChangeRecord(workspace, {
    ...intake,
    gatedAt: new Date().toISOString(),
    ready: report.ready,
    state: report.ready ? 'ready' : 'blocked',
  }, 'gate');
  console.log(renderChangeGate(report));
  process.exit(report.ready ? 0 : 1);
}
```

- [ ] **Step 4: Add the host pack path to the manifest and scripts**

```json
{
  "version": "0.4.6.5",
  "memory": {
    "packs": "memory/packs/<host>.md"
  }
}
```

```json
{
  "scripts": {
    "memory-review": "node ./bin/agent-system.mjs memory review --host qwen",
    "memory-compress": "node ./bin/agent-system.mjs memory compress --host qwen",
    "memory-teach": "node ./bin/agent-system.mjs memory teach --host qwen",
    "memory-gate": "node ./bin/agent-system.mjs memory gate --host qwen",
    "memory-reflect": "node ./bin/agent-system.mjs memory reflect --host qwen",
    "memory-packs-generate": "node ./bin/agent-system.mjs memory packs generate --host qwen",
    "memory-packs-list": "node ./bin/agent-system.mjs memory packs list --host qwen"
  }
}
```

- [ ] **Step 5: Run the CLI tests and make sure they pass**

Run:
```bash
node --test tests/change-cli.test.mjs
node --test tests/memory-refinement-cli.test.mjs
node ./bin/agent-system.mjs validate
node ./bin/agent-system.mjs lint
```

Expected: all pass, and `change gate` still writes only inside the active host boundary.

- [ ] **Step 6: Commit the runtime changes**

```bash
git add bin/agent-system.mjs agent-system.json package.json
git commit -m "feat: add host memory refinement loop"
```

### Task 3: Update docs, baseline, and seed host packs

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `memory/README.md`
- Modify: `memory/change/README.md`
- Modify: `docs/change-schema.md`
- Modify: `docs/memory-schema.md`
- Modify: `docs/baselines/agent-system.mjs.md`
- Create: `memory/packs/README.md`
- Create: `memory/packs/claude.md`
- Create: `memory/packs/codex.md`
- Create: `memory/packs/qwen.md`

- [ ] **Step 1: Update the docs to describe the new host refinement flow**

```md
The host memory loop is now:
review -> compress -> gate -> teach -> reflect -> packs

All memory refinement stays inside the active host boundary.
There is no shared memory file and no cross-host promotion.
```

- [ ] **Step 2: Refresh the CLI baseline for `bin/agent-system.mjs`**

```md
## Current Baseline Notes

- `validate` checks the active profile, status files, change files, and host memory layout.
- `lint` enforces manifest consistency, memory drift checks, status presence, change presence, and pack presence.
- `memory` now owns review, compress, teach, gate, reflect, and learning pack generation per host.
- `change` still owns intake analysis, scaffold generation, preview/apply, rollback, and gate validation.
```

- [ ] **Step 3: Seed the host pack files**

```md
# Qwen Learning Pack

- Keep Luau guidance short and repeatable.
- Prefer host-local memory before broadening a rule.
- Compress repeated fixes into one durable lesson.
```

```md
# Claude Learning Pack

- Keep learning notes compact and bounded to Claude runs.
- Promote only rules that survive repeated review.
- Do not mix host-specific lessons across files.
```

```md
# Codex Learning Pack

- Keep host guidance narrow and reusable.
- Gate weak notes before they enter durable memory.
- Reuse compressed lessons instead of duplicating them.
```

- [ ] **Step 4: Run a docs and manifest verification pass**

Run:
```bash
node ./bin/agent-system.mjs validate
node ./bin/agent-system.mjs lint
git diff --check
```

Expected: the baseline reflects the new host refinement commands, and the new pack files are present in the repo.

- [ ] **Step 5: Commit the docs and seed files**

```bash
git add README.md AGENTS.md memory/README.md memory/change/README.md docs/change-schema.md docs/memory-schema.md docs/baselines/agent-system.mjs.md memory/packs
git commit -m "docs: describe host memory refinement"
```
