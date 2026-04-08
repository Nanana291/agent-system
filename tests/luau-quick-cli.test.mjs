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
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-luau-quick-'));
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

test('route suggests luau quick path for a single Luau file', () => {
  const workspace = createWorkspace();
  try {
    initGitRepo(workspace);
    writeFileSync(path.join(workspace, 'SailorPiece.lua'), `${readFileSync(path.join(workspace, 'README.md'), 'utf8')}\n-- luau quick target\n`, 'utf8');

    const result = runAgent(['route'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[QUICK ROUTE\]/);
    assert.match(result.stdout, /Type: quick-fix/);
    assert.match(result.stdout, /Skill: existing-script-feature-injection/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('luau-quick writes a fast gate and luau memory note', () => {
  const workspace = createWorkspace();
  try {
    initGitRepo(workspace);
    writeFileSync(path.join(workspace, 'SailorPiece.lua'), `${readFileSync(path.join(workspace, 'README.md'), 'utf8')}\n-- luau quick target\n`, 'utf8');

    const result = runAgent(['luau-quick', '--host', 'qwen'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[LUAU QUICK\]/);
    assert.match(result.stdout, /\[QUICK LOCK\]/);
    assert.match(result.stdout, /\[QUICK GATE\]/);
    assert.match(result.stdout, /Luau target/);

    const current = JSON.parse(readFileSync(path.join(workspace, 'change', 'current.json'), 'utf8'));
    const memory = readFileSync(path.join(workspace, 'memory', 'change', 'qwen.md'), 'utf8');

    assert.equal(current.type, 'quick-fix');
    assert.equal(current.target, 'SailorPiece.lua');
    assert.match(memory, /Luau lesson/);
    assert.equal(existsSync(path.join(workspace, 'change', 'intake.md')), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
