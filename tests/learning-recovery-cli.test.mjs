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
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-recovery-'));
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

test('memory snapshot, diff, restore, and rollback recover host learning state', () => {
  const workspace = createWorkspace();
  try {
    const trainOne = runAgent(['train', '--host', 'qwen'], workspace);
    const trainTwo = runAgent(['train', '--host', 'qwen'], workspace);
    const trainThree = runAgent(['train', '--host', 'qwen'], workspace);
    assert.equal(trainOne.status, 0, trainOne.stderr);
    assert.equal(trainTwo.status, 0, trainTwo.stderr);
    assert.equal(trainThree.status, 0, trainThree.stderr);

    const snapshotPath = path.join(workspace, 'learning-snapshot.json');
    const snapshot = runAgent(['memory', 'snapshot', '--host', 'qwen', snapshotPath], workspace);
    assert.equal(snapshot.status, 0, snapshot.stderr);
    assert.match(snapshot.stdout, /\[LEARNING SNAPSHOT\]/);
    assert.equal(existsSync(snapshotPath), true);

    const snapshotData = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    assert.equal(snapshotData.snapshotVersion, 1);
    assert.equal(snapshotData.packVersion, 1);
    const originalHostMemory = snapshotData.files['memory/host/qwen.md'];
    const originalProfileMemory = snapshotData.files['memory/profile/imphub.md'];
    assert.equal(snapshotData.files['docs/training/packs/qwen.json'].kind, 'json');
    assert.equal(snapshotData.files['docs/training/packs/qwen.json'].value.packVersion, 1);

    writeFileSync(path.join(workspace, 'memory', 'host', 'qwen.md'), '# Qwen Host Memory\n\n- Corrupted host lesson.\n', 'utf8');
    writeFileSync(path.join(workspace, 'memory', 'profile', 'imphub.md'), '# Imphub Memory\n\n- Corrupted profile lesson.\n', 'utf8');
    writeFileSync(path.join(workspace, 'docs', 'training', 'current.json'), JSON.stringify({ kind: 'agent-system-training', version: 1, mode: 'error' }, null, 2) + '\n', 'utf8');

    const diff = runAgent(['memory', 'diff', '--file', snapshotPath], workspace);
    assert.equal(diff.status, 0, diff.stderr);
    assert.match(diff.stdout, /\[LEARNING DIFF\]/);
    assert.match(diff.stdout, /memory\/host\/qwen\.md/);
    assert.match(diff.stdout, /memory\/profile\/imphub\.md/);

    const restore = runAgent(['memory', 'restore', '--file', snapshotPath], workspace);
    assert.equal(restore.status, 0, restore.stderr);
    assert.match(restore.stdout, /\[LEARNING RESTORE\]/);

    const restoredHostMemory = readFileSync(path.join(workspace, 'memory', 'host', 'qwen.md'), 'utf8');
    const restoredProfileMemory = readFileSync(path.join(workspace, 'memory', 'profile', 'imphub.md'), 'utf8');
    assert.equal(restoredHostMemory, originalHostMemory);
    assert.equal(restoredProfileMemory, originalProfileMemory);

    writeFileSync(path.join(workspace, 'memory', 'host', 'qwen.md'), '# Qwen Host Memory\n\n- Corrupted again.\n', 'utf8');
    const rollback = runAgent(['memory', 'rollback', '--host', 'qwen'], workspace);
    assert.equal(rollback.status, 0, rollback.stderr);
    assert.match(rollback.stdout, /\[LEARNING RESTORE\]/);

    const rolledBackHostMemory = readFileSync(path.join(workspace, 'memory', 'host', 'qwen.md'), 'utf8');
    assert.equal(rolledBackHostMemory, originalHostMemory);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('train rollback restores the latest host learning snapshot', () => {
  const workspace = createWorkspace();
  try {
    const train = runAgent(['train', '--host', 'claude'], workspace);
    assert.equal(train.status, 0, train.stderr);

    const latestSnapshot = path.join(workspace, 'docs', 'training', 'recovery', 'claude', 'latest.json');
    assert.equal(existsSync(latestSnapshot), true);
    const snapshotData = JSON.parse(readFileSync(latestSnapshot, 'utf8'));
    assert.equal(snapshotData.snapshotVersion, 1);
    assert.equal(snapshotData.packVersion, 1);
    const originalHostMemory = snapshotData.files['memory/host/claude.md'];

    writeFileSync(path.join(workspace, 'memory', 'host', 'claude.md'), '# Claude Host Memory\n\n- Broken lesson.\n', 'utf8');
    const rollback = runAgent(['train', 'rollback', '--host', 'claude'], workspace);
    assert.equal(rollback.status, 0, rollback.stderr);
    assert.match(rollback.stdout, /\[TRAIN ROLLBACK\]/);

    const restoredHostMemory = readFileSync(path.join(workspace, 'memory', 'host', 'claude.md'), 'utf8');
    assert.equal(restoredHostMemory, originalHostMemory);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
