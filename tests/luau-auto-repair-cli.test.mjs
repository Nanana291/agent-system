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
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-luau-auto-repair-'));
  cpSync(path.join(repoRoot, 'agent-system.json'), path.join(dir, 'agent-system.json'));
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

function initGitRepo(workspace) {
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: workspace, encoding: 'utf8' }).status, 0);
  assert.equal(spawnSync('git', ['config', 'user.name', 'Agent System Tests'], { cwd: workspace, encoding: 'utf8' }).status, 0);
  assert.equal(spawnSync('git', ['config', 'user.email', 'tests@example.com'], { cwd: workspace, encoding: 'utf8' }).status, 0);
  assert.equal(spawnSync('git', ['add', '.'], { cwd: workspace, encoding: 'utf8' }).status, 0);
  assert.equal(spawnSync('git', ['commit', '-q', '-m', 'baseline'], { cwd: workspace, encoding: 'utf8' }).status, 0);
}

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

test('luau-diagnose reports the selected Luau repair path and issues', () => {
  const workspace = createWorkspace();
  try {
    initGitRepo(workspace);
    writeFileSync(path.join(workspace, 'SailorPiece.lua'), '-- luau target\n', 'utf8');
    writeFileSync(path.join(workspace, 'Combat.lua'), '-- second luau target\n', 'utf8');
    writeFileSync(path.join(workspace, 'settings.json'), '{ "hotPath": true }\n', 'utf8');

    const result = runAgent(['luau-diagnose', '--host', 'qwen'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[LUAU DIAGNOSE\]/);
    assert.match(result.stdout, /Selected path: luau-repair/);
    assert.match(result.stdout, /Risk:/);
    assert.match(result.stdout, /Issues:/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

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

test('train and eval auto-detect Luau repair context after luau-repair', () => {
  const workspace = createWorkspace();
  try {
    initGitRepo(workspace);
    writeFileSync(path.join(workspace, 'SailorPiece.lua'), '-- luau target\n', 'utf8');
    writeFileSync(path.join(workspace, 'Combat.lua'), '-- second luau target\n', 'utf8');
    writeFileSync(path.join(workspace, 'settings.json'), '{ "hotPath": true }\n', 'utf8');

    const repair = runAgent(['luau-repair', '--host', 'qwen'], workspace);
    assert.equal(repair.status, 0, repair.stderr);

    const train = runAgent(['train', 'sync', '--host', 'qwen'], workspace);
    assert.equal(train.status, 0, train.stderr);
    assert.match(train.stdout, /Focus: Luau/);
    assert.match(train.stdout, /Luau lesson:/);

    const evalRun = runAgent(['eval', 'compare', '--host', 'qwen'], workspace);
    assert.equal(evalRun.status, 0, evalRun.stderr);
    assert.match(evalRun.stdout, /Focus: Luau/);
    assert.match(evalRun.stdout, /Luau lesson:/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

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
