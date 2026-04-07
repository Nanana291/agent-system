# Change Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a universal change-orchestration layer that makes updates and new-project bootstraps easier, safer, and less error-prone by turning an intent into a structured intake, scaffold, and delivery gate.

**Architecture:** Keep the feature small and universal: `change analyze` derives a structured change intake from the current workspace, `change scaffold` creates the missing artifacts for that intake, and `change gate` verifies the result before delivery. The CLI stays in `bin/agent-system.mjs`, while persistent state lives in `change/` and shared schema/docs live in `docs/` and `templates/`.

**Tech Stack:** Node.js ESM CLI, JSON manifests, markdown templates, Node `test`, existing `agent-system.json`/`README.md`/`templates/` conventions.

---

### Task 1: Add failing tests for the change workflow

**Files:**
- Create: `tests/change-cli.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
test('change analyze emits a task lock summary', () => {
  const result = runChange(['analyze', '--type', 'update', '--target', 'bin/agent-system.mjs', '--intent', 'add universal change orchestration'], workspace);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[TASK LOCK\]/);
  assert.match(result.stdout, /Task type: update/);
  assert.match(result.stdout, /Target file: bin\/agent-system\.mjs/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/change-cli.test.mjs`
Expected: FAIL because `change` is not implemented yet.

- [ ] **Step 3: Write minimal implementation**

No production code yet. Keep this red until the CLI work lands.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/change-cli.test.mjs`
Expected: PASS after the CLI and files are implemented.

- [ ] **Step 5: Commit**

```bash
git add tests/change-cli.test.mjs
git commit -m "test: cover change orchestration workflow"
```

### Task 2: Add change workspace files and manifest paths

**Files:**
- Modify: `agent-system.json`
- Modify: `package.json`
- Modify: `README.md`
- Create: `change/README.md`
- Create: `change/current.json`
- Create: `change/history.jsonl`
- Create: `docs/change-schema.md`
- Create: `templates/change-intake.md`

- [ ] **Step 1: Write the failing test**

```js
assert.equal(fs.existsSync(path.join(workspace, 'change', 'current.json')), true);
assert.equal(fs.existsSync(path.join(workspace, 'change', 'history.jsonl')), true);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/change-cli.test.mjs`
Expected: FAIL because the change workspace files are missing.

- [ ] **Step 3: Write minimal implementation**

Add these manifest paths:

```json
{
  "paths": {
    "change": "change"
  },
  "change": {
    "current": "change/current.json",
    "history": "change/history.jsonl",
    "readme": "change/README.md",
    "schema": "docs/change-schema.md",
    "intakeTemplate": "templates/change-intake.md"
  }
}
```

Add package scripts:

```json
{
  "scripts": {
    "change": "node ./bin/agent-system.mjs change",
    "change-analyze": "node ./bin/agent-system.mjs change analyze",
    "change-scaffold": "node ./bin/agent-system.mjs change scaffold",
    "change-gate": "node ./bin/agent-system.mjs change gate"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/change-cli.test.mjs`
Expected: PASS after the files exist and the manifest points to them.

- [ ] **Step 5: Commit**

```bash
git add agent-system.json package.json README.md change/ docs/change-schema.md templates/change-intake.md
git commit -m "feat: add change workspace metadata"
```

### Task 3: Implement `change analyze`, `change scaffold`, and `change gate`

**Files:**
- Modify: `bin/agent-system.mjs`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `change/README.md`
- Modify: `docs/change-schema.md`

- [ ] **Step 1: Write the failing test**

```js
test('change scaffold creates a task lock and gate scaffold', () => {
  const result = runChange(['scaffold', '--type', 'new-project', '--name', 'demo-change'], workspace);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Initialized change workspace/);
  assert.equal(fs.existsSync(path.join(workspace, 'change', 'current.json')), true);
  assert.equal(fs.existsSync(path.join(workspace, 'templates', 'change-intake.md')), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/change-cli.test.mjs`
Expected: FAIL with `Unknown command: change`.

- [ ] **Step 3: Write minimal implementation**

Add a `change` top-level command with subcommands:

```js
case 'change':
  await handleChange(workspace, flags, positional);
  return;
```

Implement these outputs:

```text
[TASK LOCK]
Task type: update | new-project
Target file: <path>
Route selected: <route>
Process skill: brainstorming
Change classification: <tags>
Baseline file: <path or n/a>
Owned domains: <domains>
Stop-line risks: <risks>
```

```text
[CHANGE GATE]
Intake captured: yes/no
Baseline updated: yes/no
Regression matrix: yes/no
Old->new mapping: yes/no
Owned domains closed: yes/no
Open risks: <text>
Blocked / Ready: Blocked | Ready
```

`change scaffold` should create the current intake file and a markdown scaffold using `templates/change-intake.md`. `change gate` should fail when the intake is incomplete and pass when required fields are filled.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/change-cli.test.mjs && node ./bin/agent-system.mjs validate && node ./bin/agent-system.mjs lint`
Expected: PASS with no validation or lint regressions.

- [ ] **Step 5: Commit**

```bash
git add bin/agent-system.mjs README.md AGENTS.md change/ docs/change-schema.md tests/change-cli.test.mjs templates/change-intake.md
git commit -m "feat: add universal change orchestration"
```

### Task 4: Verify and publish the release

**Files:**
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

```js
assert.match(readFileSync('README.md', 'utf8'), /V0\.4\.3 scope/);
assert.match(readFileSync('README.md', 'utf8'), /node \.\/bin\/agent-system\.mjs change analyze/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/change-cli.test.mjs`
Expected: FAIL until the docs are updated.

- [ ] **Step 3: Write minimal implementation**

Update the README command examples and version strings to `0.4.3`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/change-cli.test.mjs && node ./bin/agent-system.mjs validate && node ./bin/agent-system.mjs lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md package.json
git commit -m "docs: describe change orchestration workflow"
```

## Self-Review

- Coverage: analyze, scaffold, gate, manifest paths, docs, and tests are all assigned.
- Placeholders: none in the live requirements; all commands and file paths are explicit.
- Type consistency: command names are `change analyze`, `change scaffold`, and `change gate` throughout the plan.
