import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'bin', 'agent-system.mjs');

function createWorkspace() {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-quick-update-'));
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

test('quick-update creates a ready intake from target and intent without git diff', () => {
  const workspace = createWorkspace();
  try {
    const result = runAgent([
      'quick-update',
      '--target', 'bin/agent-system.mjs',
      '--intent', 'prepare a fast update path for qwen',
    ], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[QUICK UPDATE\]/);
    assert.match(result.stdout, /Target file: bin\/agent-system\.mjs/);
    assert.match(result.stdout, /Gate status: Ready/);
    assert.equal(existsSync(path.join(workspace, 'change', 'current.json')), true);
    assert.equal(existsSync(path.join(workspace, 'change', 'intake.md')), true);

    const intake = JSON.parse(readFileSync(path.join(workspace, 'change', 'current.json'), 'utf8'));
    assert.equal(intake.type, 'update');
    assert.equal(intake.target, 'bin/agent-system.mjs');
    assert.match(intake.intent, /prepare a fast update path for qwen/);
    assert.equal(intake.ready, true);
    assert.equal(intake.state, 'ready');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('quick-update reuses the current intake when target and intent are already present', () => {
  const workspace = createWorkspace();
  try {
    const initial = runAgent([
      'quick-update',
      '--target', 'bin/agent-system.mjs',
      '--intent', 'prepare a normal update path',
    ], workspace);
    assert.equal(initial.status, 0, initial.stderr);

    const rerun = runAgent(['quick-update'], workspace);
    assert.equal(rerun.status, 0, rerun.stderr);
    assert.match(rerun.stdout, /\[QUICK UPDATE\]/);
    assert.match(rerun.stdout, /Target file: bin\/agent-system\.mjs/);

    const intake = JSON.parse(readFileSync(path.join(workspace, 'change', 'current.json'), 'utf8'));
    assert.equal(intake.target, 'bin/agent-system.mjs');
    assert.match(intake.intent, /prepare a normal update path/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
