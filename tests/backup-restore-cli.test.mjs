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
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-backup-'));
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

function runWrapper(wrapperName, cwd, args = []) {
  return spawnSync('node', [path.join(repoRoot, 'bin', wrapperName), ...args], {
    cwd,
    encoding: 'utf8',
  });
}

test('backup creates a full mutable-state bundle with explicit host metadata', () => {
  const workspace = createWorkspace();
  try {
    const bundlePath = path.join(workspace, 'qwen-backup.json');
    const result = runAgent(['backup', '--profile', 'imphub', '--host', 'qwen', bundlePath], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Backed up imphub to/);
    assert.equal(existsSync(bundlePath), true);

    const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
    assert.equal(bundle.kind, 'agent-system-backup');
    assert.equal(bundle.backupVersion, 1);
    assert.equal(bundle.activeProfile, 'imphub');
    assert.equal(bundle.activeHost, 'qwen');
    assert.equal(typeof bundle.files['agent-system.json'], 'object');
    assert.equal(typeof bundle.files['package.json'], 'object');
    assert.equal(typeof bundle.files['README.md'], 'string');
    assert.equal(typeof bundle.files['AGENTS.md'], 'string');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('bundle validate rejects incomplete snapshots and bundle diff reports differences', () => {
  const workspace = createWorkspace();
  try {
    const bundlePath = path.join(workspace, 'broken-snapshot.json');
    writeFileSync(bundlePath, JSON.stringify({ kind: 'agent-system-backup', backupVersion: 1 }, null, 2) + '\n', 'utf8');

    const validate = runAgent(['bundle', 'validate', '--file', bundlePath], workspace);
    assert.notEqual(validate.status, 0);
    assert.match(validate.stdout, /\[BUNDLE VALIDATE\]/);
    assert.match(validate.stdout, /Ready: no/);

    const diff = runAgent(['bundle', 'diff', '--file', bundlePath], workspace);
    assert.equal(diff.status, 0, diff.stderr);
    assert.match(diff.stdout, /\[BUNDLE DIFF\]/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('backup validate wrapper validates a generated bundle', () => {
  const workspace = createWorkspace();
  try {
    const bundlePath = path.join(workspace, 'wrapper-backup.json');
    const backup = runAgent(['backup', '--profile', 'imphub', '--host', 'qwen', bundlePath], workspace);
    assert.equal(backup.status, 0, backup.stderr);

    const validate = runWrapper('backup-validate.mjs', workspace, [bundlePath]);
    assert.equal(validate.status, 0, validate.stderr);
    assert.match(validate.stdout, /\[BUNDLE VALIDATE\]/);
    assert.match(validate.stdout, /Ready: yes/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('bundle prune removes duplicate noise from the snapshot', () => {
  const workspace = createWorkspace();
  try {
    const bundlePath = path.join(workspace, 'prune-snapshot.json');
    const backup = runAgent(['backup', '--profile', 'imphub', '--host', 'qwen', bundlePath], workspace);
    assert.equal(backup.status, 0, backup.stderr);

    const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
    bundle.memory.change = '# Qwen Change Memory\n\n- Keep host memory flat.\n- Keep host memory flat.\n';
    writeFileSync(bundlePath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');

    const prune = runAgent(['bundle', 'prune', '--file', bundlePath], workspace);
    assert.equal(prune.status, 0, prune.stderr);
    assert.match(prune.stdout, /\[BUNDLE PRUNE\]/);

    const pruned = JSON.parse(readFileSync(bundlePath, 'utf8'));
    assert.match(pruned.memory.change, /Keep host memory flat\./);
    assert.equal((pruned.memory.change.match(/Keep host memory flat\./g) || []).length, 1);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('restore round-trips a backup bundle into a clean workspace', () => {
  const workspace = createWorkspace();
  try {
    const bundlePath = path.join(workspace, 'agent-system-backup.json');
    const backup = runAgent(['backup', '--profile', 'imphub', '--host', 'qwen', bundlePath], workspace);

    assert.equal(backup.status, 0, backup.stderr);

    const restore = runAgent(['restore', '--file', bundlePath], workspace);
    assert.equal(restore.status, 0, restore.stderr);
    assert.match(restore.stdout, /Restored imphub/);
    assert.equal(existsSync(path.join(workspace, 'memory', 'host', 'qwen.md')), true);
    assert.equal(existsSync(path.join(workspace, 'status', 'current.json')), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
