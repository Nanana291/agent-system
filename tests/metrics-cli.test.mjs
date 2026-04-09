import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'bin', 'agent-system.mjs');

function createWorkspace() {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-metrics-'));
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

test('metrics snapshot creates current, history, and immutable snapshot files', () => {
  const workspace = createWorkspace();
  try {
    const result = runAgent(['metrics', 'snapshot'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[METRICS\]/);
    assert.match(result.stdout, /Source: snapshot/);
    assert.match(result.stdout, /Snapshot:/);
    assert.equal(existsSync(path.join(workspace, 'docs', 'metrics', 'current.json')), true);
    assert.equal(existsSync(path.join(workspace, 'docs', 'metrics', 'history.jsonl')), true);
    assert.equal(existsSync(path.join(workspace, 'docs', 'metrics', 'snapshots')), true);

    const current = JSON.parse(readFileSync(path.join(workspace, 'docs', 'metrics', 'current.json'), 'utf8'));
    assert.equal(current.kind, 'agent-system-metrics');
    assert.equal(current.source, 'snapshot');
    assert.equal(current.activeProfile, 'imphub');

    writeFileSync(path.join(workspace, 'notes.txt'), 'one\nline\n', 'utf8');

    const next = runAgent(['metrics', 'snapshot'], workspace);
    assert.equal(next.status, 0, next.stderr);

    const trend = runAgent(['metrics', 'trend'], workspace);
    assert.equal(trend.status, 0, trend.stderr);
    assert.match(trend.stdout, /\[METRICS TREND\]/);
    assert.match(trend.stdout, /- lines:/);

    const compare = runAgent(['metrics', 'compare'], workspace);
    assert.equal(compare.status, 0, compare.stderr);
    assert.match(compare.stdout, /\[METRICS COMPARE\]/);
    assert.match(compare.stdout, /- lines:/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('train auto-populates the metrics trail', () => {
  const workspace = createWorkspace();
  try {
    const result = runAgent(['train', '--host', 'qwen'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(path.join(workspace, 'docs', 'metrics', 'current.json')), true);
    assert.equal(existsSync(path.join(workspace, 'docs', 'metrics', 'history.jsonl')), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('upgrade apply auto-populates the metrics trail', () => {
  const workspace = createWorkspace();
  try {
    const result = runAgent(['upgrade', 'apply'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(path.join(workspace, 'docs', 'metrics', 'current.json')), true);
    assert.equal(existsSync(path.join(workspace, 'docs', 'metrics', 'history.jsonl')), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
