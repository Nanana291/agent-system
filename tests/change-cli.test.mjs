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
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-change-'));
  cpSync(path.join(repoRoot, 'agent-system.json'), path.join(dir, 'agent-system.json'));
  cpSync(path.join(repoRoot, 'bin'), path.join(dir, 'bin'), { recursive: true });
  cpSync(path.join(repoRoot, 'docs'), path.join(dir, 'docs'), { recursive: true });
  cpSync(path.join(repoRoot, 'memory'), path.join(dir, 'memory'), { recursive: true });
  cpSync(path.join(repoRoot, 'profiles'), path.join(dir, 'profiles'), { recursive: true });
  cpSync(path.join(repoRoot, 'templates'), path.join(dir, 'templates'), { recursive: true });
  cpSync(path.join(repoRoot, 'README.md'), path.join(dir, 'README.md'));
  cpSync(path.join(repoRoot, 'AGENTS.md'), path.join(dir, 'AGENTS.md'));
  cpSync(path.join(repoRoot, 'status'), path.join(dir, 'status'), { recursive: true });

  writeFileSync(
    path.join(dir, 'status', 'current.json'),
    JSON.stringify({
      agent: null,
      name: 'Idle',
      action: 'No active agent',
      state: 'idle',
      scope: 'none',
      task: null,
      route: null,
      profile: null,
      attachedAt: null,
      heartbeatAt: null,
      startedAt: null,
      updatedAt: null,
      eta: null,
      detail: '',
      active: false,
    }, null, 2) + '\n',
    'utf8',
  );
  writeFileSync(path.join(dir, 'status', 'events.jsonl'), '', 'utf8');

  return dir;
}

function runChange(args, cwd) {
  return spawnSync('node', [cli, 'change', ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function runGit(args, cwd) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
  });
}

function initGitRepo(workspace) {
  assert.equal(runGit(['init', '-q'], workspace).status, 0);
  assert.equal(runGit(['config', 'user.name', 'Agent System Tests'], workspace).status, 0);
  assert.equal(runGit(['config', 'user.email', 'tests@example.com'], workspace).status, 0);
  assert.equal(runGit(['add', '.'], workspace).status, 0);
  assert.equal(runGit(['commit', '-q', '-m', 'baseline'], workspace).status, 0);
}

test('change analyze emits a task lock summary', () => {
  const workspace = createWorkspace();
  try {
    const result = runChange([
      'analyze',
      '--type', 'update',
      '--target', 'bin/agent-system.mjs',
      '--intent', 'add universal change orchestration',
    ], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[TASK LOCK\]/);
    assert.match(result.stdout, /Task type: update/);
    assert.match(result.stdout, /Target file: bin\/agent-system\.mjs/);
    assert.match(result.stdout, /Process skill: brainstorming/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('change scout infers the modified target from git changes', () => {
  const workspace = createWorkspace();
  try {
    initGitRepo(workspace);
    writeFileSync(path.join(workspace, 'bin', 'agent-system.mjs'), `${readFileSync(path.join(workspace, 'bin', 'agent-system.mjs'), 'utf8')}\n// scout target\n`, 'utf8');

    const result = runChange(['scout'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[TASK LOCK\]/);
    assert.match(result.stdout, /Task type: update/);
    assert.match(result.stdout, /Target file: bin\/agent-system\.mjs/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('change scaffold creates the current intake and scaffold markdown', () => {
  const workspace = createWorkspace();
  try {
    const result = runChange([
      'scaffold',
      '--type', 'new-project',
      '--name', 'demo-change',
      '--target', 'profiles/demo-change',
      '--intent', 'bootstrap a fresh agent workflow',
    ], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Initialized change workspace/);
    assert.equal(existsSync(path.join(workspace, 'change', 'current.json')), true);
    assert.equal(existsSync(path.join(workspace, 'change', 'intake.md')), true);

    const intake = JSON.parse(readFileSync(path.join(workspace, 'change', 'current.json'), 'utf8'));
    assert.equal(intake.type, 'new-project');
    assert.equal(intake.name, 'demo-change');
    assert.equal(intake.target, 'profiles/demo-change');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('change auto-scaffold creates the intake from inferred repo changes', () => {
  const workspace = createWorkspace();
  try {
    initGitRepo(workspace);
    writeFileSync(path.join(workspace, 'README.md'), `${readFileSync(path.join(workspace, 'README.md'), 'utf8')}\nAuto scaffold note.\n`, 'utf8');

    const result = runChange(['auto-scaffold'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Initialized change workspace/);
    const intake = JSON.parse(readFileSync(path.join(workspace, 'change', 'current.json'), 'utf8'));
    assert.equal(intake.type, 'update');
    assert.ok(intake.target.includes('README.md'));
    assert.equal(existsSync(path.join(workspace, 'change', 'intake.md')), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('change gate blocks incomplete intake and passes complete intake', () => {
  const workspace = createWorkspace();
  try {
    const incomplete = runChange(['gate'], workspace);
    assert.notEqual(incomplete.status, 0);
    assert.match(incomplete.stdout, /\[CHANGE GATE\]/);
    assert.match(incomplete.stdout, /Blocked \/ Ready: Blocked/);

    const scaffold = runChange([
      'scaffold',
      '--type', 'update',
      '--target', 'bin/agent-system.mjs',
      '--intent', 'tighten change orchestration',
      '--baseline', 'docs/baselines/agent-system.mjs.md',
      '--classification', 'logic,config',
      '--owned-domains', 'logic,config',
      '--regression-matrix', 'templates/regression-matrix.md',
      '--old-new', 'bin/agent-system.mjs:bin/agent-system.mjs',
    ], workspace);
    assert.equal(scaffold.status, 0, scaffold.stderr);

    const gate = runChange(['gate'], workspace);
    assert.equal(gate.status, 0, gate.stderr);
    assert.match(gate.stdout, /Blocked \/ Ready: Ready/);
    assert.match(gate.stdout, /Baseline updated: yes/);
    assert.match(gate.stdout, /Regression matrix: yes/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('change gate captures memory automatically on success', () => {
  const workspace = createWorkspace();
  try {
    const scaffold = runChange([
      'scaffold',
      '--type', 'update',
      '--target', 'bin/agent-system.mjs',
      '--intent', 'capture change memory automatically',
      '--baseline', 'docs/baselines/agent-system.mjs.md',
      '--classification', 'logic,regression-risk',
      '--owned-domains', 'logic,regression-risk',
      '--regression-matrix', 'templates/regression-matrix.md',
      '--old-new', 'bin/agent-system.mjs:bin/agent-system.mjs',
    ], workspace);

    assert.equal(scaffold.status, 0, scaffold.stderr);

    const gate = runChange(['gate'], workspace);
    assert.equal(gate.status, 0, gate.stderr);
    assert.match(gate.stdout, /Blocked \/ Ready: Ready/);

    const memoryPath = path.join(workspace, 'memory', 'change', 'imphub.md');
    assert.equal(existsSync(memoryPath), true);
    assert.match(readFileSync(memoryPath, 'utf8'), /Gate passed for update change targeting bin\/agent-system\.mjs/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
