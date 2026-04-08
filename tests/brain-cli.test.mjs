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
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-brain-'));
  cpSync(path.join(repoRoot, 'agent-system.json'), path.join(dir, 'agent-system.json'));
  cpSync(path.join(repoRoot, 'package.json'), path.join(dir, 'package.json'));
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

test('brain add/query/explain/snapshot/restore/sync manage the structured brain layer', () => {
  const workspace = createWorkspace();
  try {
    const add = runAgent(['brain', 'add', '--host', 'qwen', '--scope', 'host:qwen', '--title', 'Route fallback lesson', '--status', 'candidate', 'Keep route fallback deterministic.'], workspace);
    assert.equal(add.status, 0, add.stderr);
    assert.match(add.stdout, /\[BRAIN ADD\]/);

    const query = runAgent(['brain', 'query', 'fallback'], workspace);
    assert.equal(query.status, 0, query.stderr);
    assert.match(query.stdout, /\[BRAIN QUERY\]/);
    assert.match(query.stdout, /Route fallback lesson/);

    const explain = runAgent(['brain', 'explain', 'fallback'], workspace);
    assert.equal(explain.status, 0, explain.stderr);
    assert.match(explain.stdout, /\[BRAIN EXPLAIN\]/);

    const snapshotPath = path.join(workspace, 'brain-snapshot.json');
    const snapshot = runAgent(['brain', 'snapshot', snapshotPath], workspace);
    assert.equal(snapshot.status, 0, snapshot.stderr);
    assert.match(snapshot.stdout, /\[BRAIN SNAPSHOT\]/);
    assert.equal(existsSync(snapshotPath), true);

    const demote = runAgent(['brain', 'demote', 'fallback'], workspace);
    assert.equal(demote.status, 0, demote.stderr);
    assert.match(demote.stdout, /\[BRAIN DEMOTE\]/);

    const restoredBefore = JSON.parse(readFileSync(path.join(workspace, 'docs', 'brain', 'current.json'), 'utf8'));
    assert.equal(restoredBefore.entries.some((entry) => entry.status === 'demoted'), true);

    const restore = runAgent(['brain', 'restore', '--file', snapshotPath], workspace);
    assert.equal(restore.status, 0, restore.stderr);
    assert.match(restore.stdout, /\[BRAIN RESTORE\]/);

    const restoredAfter = JSON.parse(readFileSync(path.join(workspace, 'docs', 'brain', 'current.json'), 'utf8'));
    assert.equal(restoredAfter.entries.some((entry) => entry.title === 'Route fallback lesson' && entry.status !== 'demoted'), true);

    const sync = runAgent(['brain', 'sync'], workspace);
    assert.equal(sync.status, 0, sync.stderr);
    assert.match(sync.stdout, /\[BRAIN SYNC\]/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('training and change gates feed the brain automatically', () => {
  const workspace = createWorkspace();
  try {
    const train = runAgent(['train', '--host', 'qwen'], workspace);
    assert.equal(train.status, 0, train.stderr);

    const change = runAgent(['change', 'analyze', '--type', 'update', '--target', 'bin/agent-system.mjs', '--intent', 'add a brain layer'], workspace);
    assert.equal(change.status, 0, change.stderr);

    const gate = runAgent(['change', 'gate'], workspace);
    assert.equal(gate.status, 0, gate.stderr);

    const currentBrainPath = path.join(workspace, 'docs', 'brain', 'current.json');
    const historyBrainPath = path.join(workspace, 'docs', 'brain', 'history.jsonl');
    assert.equal(existsSync(currentBrainPath), true);
    assert.equal(existsSync(historyBrainPath), true);

    const brain = JSON.parse(readFileSync(currentBrainPath, 'utf8'));
    assert.equal(Array.isArray(brain.entries), true);
    assert.equal(brain.entries.length > 0, true);
    assert.equal(brain.entries.some((entry) => String(entry.source).startsWith('train-')), true);

    const query = runAgent(['brain', 'query', 'brain'], workspace);
    assert.equal(query.status, 0, query.stderr);
    assert.match(query.stdout, /\[BRAIN QUERY\]/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
