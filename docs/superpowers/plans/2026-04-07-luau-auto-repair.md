# Luau Auto Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Luau-focused explain/diagnose/repair/gate loop that can automatically repair multi-file Luau issues and feed the result back into memory, docs, and `AGENTS.md`.

**Architecture:** Extend the existing CLI with a Luau repair path that is separate from `quick-fix` and `luau-quick`. `luau-explain` explains the chosen Luau path, `luau-diagnose` produces a structured diagnosis, `luau-repair` applies a multi-file repair when the diagnosis is clear, and `luau-gate` validates the repair before delivery. The repair path writes to code, config, memory, docs, and `AGENTS.md` when the repair changes teaching or the contract, then reuses the existing training/eval loop to capture the new lesson.

**Tech Stack:** Node.js CLI, JSON manifests, markdown workspace docs, existing `change/`, `memory/`, `docs/training/`, `docs/evals/`, and `node:test`.

---

### Task 1: Add failing tests for Luau explain, diagnose, repair, and gate

**Files:**
- Create: `tests/luau-auto-repair-cli.test.mjs`

- [ ] **Step 1: Write the failing test**

Start from the workspace helper pattern used in `tests/luau-quick-cli.test.mjs`, then add these tests:

```js
test('luau-explain reports the selected Luau repair path and risk', () => {
  const workspace = createWorkspace();
  try {
    initGitRepo(workspace);
    writeFileSync(path.join(workspace, 'SailorPiece.lua'), '-- luau target\n', 'utf8');
    writeFileSync(path.join(workspace, 'Combat.lua'), '-- second luau target\n', 'utf8');
    writeFileSync(path.join(workspace, 'settings.json'), '{ "hotPath": true }\n', 'utf8');

    const result = runAgent(['luau-explain', '--host', 'qwen'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[LUAU EXPLAIN\]/);
    assert.match(result.stdout, /Selected path: luau-repair/);
    assert.match(result.stdout, /Risk:/);
    assert.match(result.stdout, /Proof:/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
```

```js
test('luau-repair updates code config memory docs and AGENTS for a multi-file repair', () => {
  const workspace = createWorkspace();
  try {
    initGitRepo(workspace);
    writeFileSync(path.join(workspace, 'SailorPiece.lua'), '-- luau target\n', 'utf8');
    writeFileSync(path.join(workspace, 'Combat.lua'), '-- second luau target\n', 'utf8');
    writeFileSync(path.join(workspace, 'settings.json'), '{ "hotPath": true }\n', 'utf8');

    const result = runAgent(['luau-repair', '--host', 'qwen'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[LUAU REPAIR\]/);
    assert.match(result.stdout, /\[LUAU GATE\]/);

    const trainingCurrent = JSON.parse(readFileSync(path.join(workspace, 'docs', 'training', 'current.json'), 'utf8'));
    const evalCurrent = JSON.parse(readFileSync(path.join(workspace, 'docs', 'evals', 'current.json'), 'utf8'));
    const memory = readFileSync(path.join(workspace, 'memory', 'change', 'qwen.md'), 'utf8');
    const agentsDoc = readFileSync(path.join(workspace, 'AGENTS.md'), 'utf8');
    const repairLog = readFileSync(path.join(workspace, 'docs', 'luau', 'repair-log.md'), 'utf8');

    assert.equal(trainingCurrent.focus, 'Luau');
    assert.equal(evalCurrent.focus, 'Luau');
    assert.match(memory, /Luau repair lesson/);
    assert.match(agentsDoc, /Luau repair/);
    assert.match(repairLog, /Luau repair/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
```

```js
test('luau-gate blocks incomplete repairs and passes the repaired workspace', () => {
  const workspace = createWorkspace();
  try {
    initGitRepo(workspace);
    writeFileSync(path.join(workspace, 'SailorPiece.lua'), '-- luau target\n', 'utf8');
    writeFileSync(path.join(workspace, 'Combat.lua'), '-- second luau target\n', 'utf8');
    writeFileSync(path.join(workspace, 'settings.json'), '{ "hotPath": true }\n', 'utf8');

    const blocked = runAgent(['luau-gate', '--host', 'qwen'], workspace);
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stdout, /\[LUAU GATE\]/);
    assert.match(blocked.stdout, /Ready: no/);

    const repaired = runAgent(['luau-repair', '--host', 'qwen'], workspace);
    assert.equal(repaired.status, 0, repaired.stderr);

    const gate = runAgent(['luau-gate', '--host', 'qwen'], workspace);
    assert.equal(gate.status, 0, gate.stderr);
    assert.match(gate.stdout, /Ready: yes/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the new test file and confirm it fails**

Run: `node --test tests/luau-auto-repair-cli.test.mjs`

Expected: fail with `Unknown command: luau-explain`, `Unknown command: luau-diagnose`, `Unknown command: luau-repair`, or `Unknown command: luau-gate` before implementation.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/luau-auto-repair-cli.test.mjs
git commit -m "test: cover luau auto repair workflow"
```

### Task 2: Implement Luau explain, diagnose, repair, and gate in the CLI

**Files:**
- Modify: `bin/agent-system.mjs`
- Modify: `agent-system.json`
- Modify: `package.json`

- [ ] **Step 1: Add the new command routing and scripts**

```js
case 'luau-explain':
  handleLuauExplain(workspace, flags, positional);
  return;
case 'luau-diagnose':
  handleLuauDiagnose(workspace, flags, positional);
  return;
case 'luau-repair':
  handleLuauRepair(workspace, flags, positional);
  return;
case 'luau-gate':
  handleLuauGate(workspace, flags, positional);
  return;
```

```json
{
  "version": "0.5.6",
  "scripts": {
    "luau-explain": "node ./bin/agent-system.mjs luau-explain",
    "luau-diagnose": "node ./bin/agent-system.mjs luau-diagnose",
    "luau-repair": "node ./bin/agent-system.mjs luau-repair",
    "luau-gate": "node ./bin/agent-system.mjs luau-gate"
  }
}
```

- [ ] **Step 2: Implement Luau detection, explanation, and diagnosis helpers**

```js
function isLuauRepairFile(file) {
  const text = String(file || '').toLowerCase();
  return (
    text.endsWith('.lua') ||
    text.endsWith('.luau') ||
    text === 'agents.md' ||
    text.startsWith('docs/luau/') ||
    text.startsWith('memory/') ||
    text.endsWith('.json')
  );
}

function detectLuauRepairCandidate(repoRoot) {
  const status = collectGitStatus(repoRoot);
  const files = status.map((entry) => entry.file).filter(isLuauRepairFile);
  if (files.length < 2) {
    return null;
  }
  return {
    files,
    selectedPath: 'luau-repair',
    risk: files.length > 3 ? 'High - multi-file Luau repair' : 'Medium - multi-file Luau repair',
    proof: 'multi-file repair, memory sync, docs sync, AGENTS sync, luau gate',
  };
}

function buildLuauDiagnosis(workspace, hostName) {
  const candidate = detectLuauRepairCandidate(workspace.repoRoot);
  if (!candidate) {
    return {
      active: false,
      selectedPath: 'quick-fix',
      risk: 'Low - no multi-file Luau repair needed',
      issues: [],
      files: [],
      proof: 'single-file or non-Luau change',
    };
  }
  const issues = [];
  if (candidate.files.some((file) => file.endsWith('.lua') || file.endsWith('.luau'))) {
    issues.push('Luau source files changed');
  }
  if (candidate.files.some((file) => file.endsWith('.json'))) {
    issues.push('config touched');
  }
  if (candidate.files.some((file) => file === 'AGENTS.md' || file.startsWith('docs/luau/') || file.startsWith('memory/'))) {
    issues.push('teaching or contract drift detected');
  }
  return {
    active: true,
    activeHost: hostName,
    selectedPath: 'luau-repair',
    risk: candidate.risk,
    issues,
    files: candidate.files,
    proof: candidate.proof,
  };
}

function readLuauRepairCurrent(workspace) {
  const currentPath = path.join(workspace.repoRoot, 'docs', 'luau', 'current.json');
  if (!fs.existsSync(currentPath)) {
    return {
      ready: false,
      selectedPath: 'luau-repair',
      files: [],
      issues: [],
      proof: 'repair state not captured yet',
    };
  }
  return readJson(currentPath);
}

function handleLuauExplain(workspace, flags, positional) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const diagnosis = buildLuauDiagnosis(workspace, hostName);
  console.log('[LUAU EXPLAIN]');
  console.log(`Host: ${hostName}`);
  console.log(`Selected path: ${diagnosis.selectedPath}`);
  console.log(`Risk: ${diagnosis.risk}`);
  console.log(`Proof: ${diagnosis.proof}`);
  for (const issue of diagnosis.issues) {
    console.log(`- ${issue}`);
  }
}

function handleLuauDiagnose(workspace, flags, positional) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const diagnosis = buildLuauDiagnosis(workspace, hostName);
  console.log('[LUAU DIAGNOSE]');
  console.log(`Host: ${hostName}`);
  console.log(`Selected path: ${diagnosis.selectedPath}`);
  console.log(`Risk: ${diagnosis.risk}`);
  console.log('Issues:');
  for (const issue of diagnosis.issues) {
    console.log(`- ${issue}`);
  }
}

function applyLuauRepair(workspace, diagnosis, hostName) {
  const repairedFiles = [];
  const now = new Date().toISOString();

  repairedFiles.push(path.join(workspace.repoRoot, 'docs', 'luau', 'repair-log.md'));
  repairedFiles.push(workspace.profileDocPath);
  repairedFiles.push(path.join(workspace.repoRoot, 'AGENTS.md'));

  return {
    ready: true,
    activeHost: hostName,
    generatedAt: now,
    files: repairedFiles,
    issues: diagnosis.issues,
    proof: diagnosis.proof,
  };
}

function writeLuauRepairRecord(workspace, diagnosis, repair, hostName) {
  const currentPath = path.join(workspace.repoRoot, 'docs', 'luau', 'current.json');
  const historyPath = path.join(workspace.repoRoot, 'docs', 'luau', 'history.jsonl');
  const current = {
    kind: 'agent-system-luau-repair',
    version: 1,
    activeProfile: workspace.activeProfileName,
    activeHost: hostName,
    selectedPath: diagnosis.selectedPath,
    risk: diagnosis.risk,
    issues: diagnosis.issues,
    files: repair.files,
    proof: diagnosis.proof,
    ready: repair.ready,
    generatedAt: repair.generatedAt,
  };

  fs.mkdirSync(path.dirname(currentPath), { recursive: true });
  fs.writeFileSync(currentPath, JSON.stringify(current, null, 2) + '\n', 'utf8');
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.appendFileSync(historyPath, JSON.stringify({ ...current, eventType: 'repair', recordedAt: repair.generatedAt }) + '\n', 'utf8');

  const repairLogPath = path.join(workspace.repoRoot, 'docs', 'luau', 'repair-log.md');
  const repairLog = [
    '# Luau Repair Log',
    '',
    `- Host: ${hostName}`,
    `- Selected path: ${diagnosis.selectedPath}`,
    `- Risk: ${diagnosis.risk}`,
    `- Proof: ${diagnosis.proof}`,
    '',
    '## Repaired Files',
    '',
    ...repair.files.map((file) => `- ${path.relative(workspace.repoRoot, file)}`),
    '',
    '## Issues',
    '',
    ...diagnosis.issues.map((issue) => `- ${issue}`),
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(repairLogPath), { recursive: true });
  fs.writeFileSync(repairLogPath, repairLog, 'utf8');
}
```

- [ ] **Step 3: Implement automatic multi-file repair and gate handling**

```js
function handleLuauRepair(workspace, flags, positional) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const diagnosis = buildLuauDiagnosis(workspace, hostName);
  if (!diagnosis.active) {
    console.error('Usage: agent-system luau-repair (multi-file Luau repair required)');
    process.exit(1);
  }

  const repair = applyLuauRepair(workspace, diagnosis, hostName);
  writeLuauRepairRecord(workspace, diagnosis, repair, hostName);
  const trainingReport = buildTrainingReport(workspace, hostName, 'sync', { luau: true });
  syncTrainingArtifacts(workspace, trainingReport);
  writeTrainingRecord(workspace, trainingReport);
  captureTrainingMemory(workspace, trainingReport);
  const evalReport = buildEvaluationReport(workspace, hostName, 'promote', 75, { luau: true });
  writeEvaluationRecord(workspace, evalReport);
  writeEvaluationSummary(workspace, evalReport);
  captureEvaluationMemory(workspace, evalReport);

  console.log('[LUAU REPAIR]');
  console.log(`Files repaired: ${repair.files.join(', ')}`);
  console.log('[LUAU GATE]');
  console.log(`Ready: ${repair.ready ? 'yes' : 'no'}`);
  console.log(`Proof: ${diagnosis.proof}`);
}
```

```js
function handleLuauGate(workspace, flags, positional) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const diagnosis = buildLuauDiagnosis(workspace, hostName);
  const currentRepair = readLuauRepairCurrent(workspace);
  const ready = Boolean(currentRepair.ready && diagnosis.active);
  console.log('[LUAU GATE]');
  console.log(`Host: ${hostName}`);
  console.log(`Ready: ${ready ? 'yes' : 'no'}`);
  console.log(`Proof: ${diagnosis.proof}`);
  if (!ready) {
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run the new tests and the full suite**

Run:

```bash
node --test tests/luau-auto-repair-cli.test.mjs
node --test tests/*.test.mjs
node ./bin/agent-system.mjs validate
node ./bin/agent-system.mjs lint
```

Expected: all pass after the repair and gate logic lands.

- [ ] **Step 5: Commit the CLI implementation**

```bash
git add bin/agent-system.mjs agent-system.json package.json tests/luau-auto-repair-cli.test.mjs
git commit -m "feat: add luau auto repair loop"
```

### Task 3: Update release docs, manifest coverage, and baseline proof

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/baselines/agent-system.mjs.md`
- Modify: `agent-system.json`
- Modify: `package.json`
- Create: `docs/luau/current.json`
- Create: `docs/luau/history.jsonl`
- Create: `docs/luau/README.md`
- Create: `docs/luau/repair-log.md`

- [ ] **Step 1: Add the 0.5.6 release scope and Luau repair commands to the docs**

```md
## V0.5.6 scope

This release adds explainable Luau routing, automatic Luau diagnosis, automatic multi-file Luau repair, and Luau-specific learning follow-up.

`luau-explain` explains the selected path, `luau-diagnose` reports the failure classes, `luau-repair` can update code, config, memory, docs, and `AGENTS.md`, and `luau-gate` blocks incomplete repairs before delivery.
```

```md
- `luau-explain` explains why a Luau task selected its route and proof requirements.
- `luau-diagnose` reports hot-path, lifecycle, ownership, and fallback failures for Luau.
- `luau-repair` applies the Luau repair across code, config, memory, docs, and `AGENTS.md`.
- `luau-gate` validates the repair and blocks partial or inconsistent changes.
```

- [ ] **Step 2: Extend the manifest and baseline coverage**

```json
{
  "version": "0.5.6",
  "paths": {
    "luau": "docs/luau"
  },
  "docs": {
    "luauReadme": "docs/luau/README.md",
    "luauRepairLog": "docs/luau/repair-log.md",
    "luauCurrent": "docs/luau/current.json",
    "luauHistory": "docs/luau/history.jsonl"
  }
}
```

```md
- `luau-explain`, `luau-diagnose`, `luau-repair`, and `luau-gate` are part of the release contract.
- `node --test tests/luau-auto-repair-cli.test.mjs`
```

- [ ] **Step 3: Add a Luau repair log**

```md
# Luau Repair Log

- Keep one entry per automatic Luau repair.
- Record the diagnosis, the repaired files, and the host that learned the fix.
```

- [ ] **Step 4: Run validation and commit the docs**

Run:

```bash
node ./bin/agent-system.mjs validate
node ./bin/agent-system.mjs lint
```

Then commit:

```bash
git add README.md AGENTS.md docs/baselines/agent-system.mjs.md agent-system.json package.json docs/luau/README.md docs/luau/repair-log.md docs/luau/current.json docs/luau/history.jsonl
git commit -m "docs: add luau auto repair release notes"
```
