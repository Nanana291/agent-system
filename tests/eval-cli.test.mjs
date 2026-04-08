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
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-eval-'));
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

test('eval simulate writes an evaluation snapshot and history', () => {
  const workspace = createWorkspace();
  try {
    const result = runAgent(['eval', 'simulate', '--host', 'qwen'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[EVAL\]/);
    assert.match(result.stdout, /Mode: simulate/);
    assert.match(result.stdout, /Score:/);

    const current = JSON.parse(readFileSync(path.join(workspace, 'docs', 'evals', 'current.json'), 'utf8'));
    const historyPath = path.join(workspace, 'docs', 'evals', 'history.jsonl');

    assert.equal(current.mode, 'simulate');
    assert.equal(current.activeHost, 'qwen');
    assert.equal(typeof current.score, 'number');
    assert.equal(existsSync(historyPath), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('eval compare records a delta against the latest run', () => {
  const workspace = createWorkspace();
  try {
    const first = runAgent(['eval', 'simulate', '--host', 'qwen'], workspace);
    assert.equal(first.status, 0, first.stderr);

    const result = runAgent(['eval', 'compare', '--host', 'qwen'], workspace);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Mode: compare/);
    assert.match(result.stdout, /Delta:/);

    const history = readFileSync(path.join(workspace, 'docs', 'evals', 'history.jsonl'), 'utf8');
    assert.equal(history.trim().split(/\r?\n/).filter(Boolean).length, 2);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('eval promote writes an evaluation sync block into profile and host memory', () => {
  const workspace = createWorkspace();
  try {
    const first = runAgent(['eval', 'simulate', '--host', 'qwen'], workspace);
    assert.equal(first.status, 0, first.stderr);

    const result = runAgent(['eval', 'promote', '--host', 'qwen'], workspace);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Mode: promote/);
    assert.match(result.stdout, /Promoted: yes/);

    const agentsDoc = readFileSync(path.join(workspace, 'AGENTS.md'), 'utf8');
    const profileDoc = readFileSync(path.join(workspace, 'profiles', 'imphub', 'AGENTS.md'), 'utf8');
    const profileMemory = readFileSync(path.join(workspace, 'memory', 'profile', 'imphub.md'), 'utf8');
    const hostMemory = readFileSync(path.join(workspace, 'memory', 'host', 'qwen.md'), 'utf8');
    const current = JSON.parse(readFileSync(path.join(workspace, 'docs', 'evals', 'current.json'), 'utf8'));

    assert.equal((agentsDoc.match(/agent-system-eval-start/g) || []).length, 1);
    assert.equal((profileDoc.match(/agent-system-eval-start/g) || []).length, 1);
    assert.equal((profileMemory.match(/agent-system-eval-start/g) || []).length, 1);
    assert.equal((hostMemory.match(/agent-system-eval-start/g) || []).length, 1);
    assert.match(agentsDoc, /Evaluation Sync/);
    assert.match(profileDoc, /Evaluation Sync/);
    assert.match(profileMemory, /Agent Evaluation Sync/);
    assert.match(hostMemory, /Agent Evaluation Sync/);
    assert.equal(current.mode, 'promote');
    assert.equal(current.promoted, true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
