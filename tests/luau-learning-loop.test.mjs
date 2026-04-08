import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'bin', 'agent-system.mjs');

function createWorkspace() {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-luau-learning-'));
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

test('Luau quick changes feed automatic training and evaluation learning', () => {
  const workspace = createWorkspace();
  try {
    initGitRepo(workspace);
    writeFileSync(path.join(workspace, 'SailorPiece.lua'), `${readFileSync(path.join(workspace, 'README.md'), 'utf8')}\n-- luau quick target\n`, 'utf8');

    const quick = runAgent(['luau-quick', '--host', 'qwen'], workspace);
    assert.equal(quick.status, 0, quick.stderr);

    const train = runAgent(['train', '--host', 'qwen'], workspace);
    assert.equal(train.status, 0, train.stderr);

    const evalResult = runAgent(['eval', '--host', 'qwen'], workspace);
    assert.equal(evalResult.status, 0, evalResult.stderr);

    const trainingCurrent = JSON.parse(readFileSync(path.join(workspace, 'docs', 'training', 'current.json'), 'utf8'));
    const evalCurrent = JSON.parse(readFileSync(path.join(workspace, 'docs', 'evals', 'current.json'), 'utf8'));
    const trainingSummary = readFileSync(path.join(workspace, trainingCurrent.summaryPath), 'utf8');
    const evalSummary = readFileSync(path.join(workspace, evalCurrent.summaryPath), 'utf8');

    assert.equal(trainingCurrent.focus, 'Luau');
    assert.equal(trainingCurrent.language, 'Luau');
    assert.match(trainingSummary, /Luau lesson/);
    assert.equal(evalCurrent.focus, 'Luau');
    assert.equal(evalCurrent.language, 'Luau');
    assert.match(evalSummary, /Luau lesson/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
