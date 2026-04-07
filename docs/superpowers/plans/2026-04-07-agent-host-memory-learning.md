# Agent Host Memory Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add host-specific self-learning so Claude, Codex, and Qwen each capture, learn, and promote lessons only inside their own memory file.

**Architecture:** Keep memory flat and host-scoped. The CLI resolves the active host from workspace context, captures change lessons into the active host change memory, and promotes repeated durable lessons into that same host's main memory file only. `change gate` becomes the automatic entry point for capture and learning, but it must never write into another host's memory file or depend on shared memory for promotion decisions.

**Tech Stack:** Node.js CLI, markdown memory files, JSON manifests, `node:test`.

---

### Task 1: Add host-scoped learning tests

**Files:**
- Modify: `tests/change-cli.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add two tests:

```js
test('memory learn promotes repeated change lessons into the active host memory', () => {
  // write repeated bullets into memory/host/qwen.md in a temp workspace
  // run: node ./bin/agent-system.mjs memory learn --host qwen --apply
  // expect: stdout contains [MEMORY LEARN] and memory/host/qwen.md gets the repeated lesson
});

test('change gate auto-runs memory learn for the active host only', () => {
  // create a gated update in a temp workspace
  // seed memory/change/qwen.md with a repeated bullet
  // run: node ./bin/agent-system.mjs change gate --profile qwen
  // expect: memory/host/qwen.md gets promoted text and memory/host/claude.md stays unchanged
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
node --test tests/change-cli.test.mjs
```

Expected: fail with `Unknown memory action: learn` for the new `memory learn` test, and the `change gate` test should fail because the host promotion has not happened yet.

- [ ] **Step 3: Commit the red tests**

```bash
git add tests/change-cli.test.mjs
git commit -m "test: cover host memory learning"
```

### Task 2: Implement host resolution and host-local memory learning

**Files:**
- Modify: `bin/agent-system.mjs`
- Modify: `agent-system.json`
- Modify: `package.json`

- [ ] **Step 1: Add the host-aware CLI behavior**

Implement these behaviors in `bin/agent-system.mjs`:

```js
// memory learn should accept --host <claude|codex|qwen>
// memory capture should write to the active host change memory file
// memory promote should only move lessons inside one host
// memory audit and stats should report per-host scope
```

Add a small resolver for host memory paths so the CLI always targets:

```text
memory/host/claude.md
memory/host/codex.md
memory/host/qwen.md
```

and never writes to a shared `memory/system.md` for this feature.

- [ ] **Step 2: Wire automatic learning into `change gate`**

After a successful gate, run host-local learning automatically:

```js
if (report.ready) {
  learnMemory(workspace.repoRoot, workspace.manifest, workspace.activeHost, 2, true);
}
```

The learning function should:
- scan the active host's change memory
- count repeated bullets
- promote repeated durable lessons into the active host memory file
- skip any lesson that mentions another host or a workspace-specific path

- [ ] **Step 3: Update version and scripts**

Set the package and manifest version to `0.4.6` and add a helper script for host learning:

```json
"memory-learn": "node ./bin/agent-system.mjs memory learn --apply"
```

- [ ] **Step 4: Verify the new CLI behavior**

Run:
```bash
node ./bin/agent-system.mjs memory learn --host qwen --apply
node ./bin/agent-system.mjs change gate --profile qwen
```

Expected:
- repeated lessons promote only into the selected host file
- other host files do not change
- `change gate` still reports ready/blocked correctly

- [ ] **Step 5: Commit the implementation**

```bash
git add bin/agent-system.mjs agent-system.json package.json
git commit -m "feat: add host-scoped memory learning"
```

### Task 3: Update docs and host memory files

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `memory/README.md`
- Modify: `memory/host/claude.md`
- Modify: `memory/host/codex.md`
- Modify: `memory/host/qwen.md`
- Modify: `docs/memory-schema.md`
- Modify: `docs/change-schema.md`

- [ ] **Step 1: Update host learning docs**

Document that each host has its own flat memory file and that `change gate` learns only within the active host. Make sure the docs do not mention any shared memory source of truth.

- [ ] **Step 2: Seed host memory rules**

Keep the host files small and specific:
- Claude: guardrails and workflow rules that suit Claude
- Codex: CLI and repo discipline
- Qwen: Luau and routing lessons learned from actual runs

- [ ] **Step 3: Verify docs reflect the new model**

Run:
```bash
node ./bin/agent-system.mjs validate
node ./bin/agent-system.mjs lint
```

Expected: both commands pass with no shared-memory references required for this feature.

- [ ] **Step 4: Commit the doc updates**

```bash
git add README.md AGENTS.md memory/README.md memory/host/claude.md memory/host/codex.md memory/host/qwen.md docs/memory-schema.md docs/change-schema.md
git commit -m "docs: describe host-scoped memory learning"
```

### Task 4: Final verification and delivery gate

**Files:**
- Modify: `tests/change-cli.test.mjs` if any assertion needs tightening

- [ ] **Step 1: Run the full verification suite**

Run:
```bash
node --test tests/change-cli.test.mjs
node ./bin/agent-system.mjs validate && node ./bin/agent-system.mjs lint
git diff --check
```

Expected:
- all tests pass
- validation passes
- lint passes
- diff check is clean

- [ ] **Step 2: Check host isolation**

Confirm the final state manually:
- `memory/host/qwen.md` contains only Qwen-promoted lessons
- `memory/host/claude.md` and `memory/host/codex.md` do not receive Qwen lessons
- `change gate` still writes its note into the active host change memory first

- [ ] **Step 3: Commit the delivery**

```bash
git add .
git commit -m "feat: host-scoped memory self-learning"
```

---

## Self-Review

- Spec coverage: host-specific capture, learning, promotion, auto-gate learning, isolation, docs, tests.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: the plan uses one host-local memory model throughout and never references a shared system memory source.
