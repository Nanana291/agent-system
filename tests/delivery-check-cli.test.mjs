import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deliveryCheck = path.join(repoRoot, 'bin', 'delivery-check.mjs');

function createWorkspace() {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-delivery-'));
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

function runDeliveryCheck(cwd) {
  return spawnSync('node', [deliveryCheck], {
    cwd,
    encoding: 'utf8',
  });
}

test('delivery-check blocks when required artifacts are missing', () => {
  const workspace = createWorkspace();
  try {
    rmSync(path.join(workspace, 'docs', 'upgrade'), { recursive: true, force: true });
    const result = runDeliveryCheck(workspace);

    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /\[DELIVERY GATE\]/);
    assert.match(`${result.stdout}${result.stderr}`, /Blocked \/ Ready: Blocked/);
    assert.match(`${result.stdout}${result.stderr}`, /missing upgrade current/);
    assert.match(`${result.stdout}${result.stderr}`, /missing upgrade history/);
    assert.match(`${result.stdout}${result.stderr}`, /missing upgrade sessions readme/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('delivery-check passes when the upgrade artifacts exist', () => {
  const workspace = createWorkspace();
  try {
    mkdirSync(path.join(workspace, 'docs', 'upgrade', 'sessions'), { recursive: true });
    writeFileSync(
      path.join(workspace, 'docs', 'upgrade', 'current.json'),
      JSON.stringify({
        kind: 'agent-system-upgrade',
        version: 1,
        mode: 'sync',
        sessionId: '2026-04-08-test-session',
        targetPath: 'AGENTS.md',
      }, null, 2) + '\n',
      'utf8',
    );
    writeFileSync(
      path.join(workspace, 'docs', 'upgrade', 'history.jsonl'),
      JSON.stringify({
        kind: 'agent-system-upgrade',
        version: 1,
        mode: 'sync',
        sessionId: '2026-04-08-test-session',
        targetPath: 'AGENTS.md',
      }) + '\n',
      'utf8',
    );
    writeFileSync(path.join(workspace, 'docs', 'upgrade', 'sessions', 'README.md'), '# Upgrade Sessions\n', 'utf8');

    const result = runDeliveryCheck(workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(`${result.stdout}${result.stderr}`, /\[DELIVERY GATE\]/);
    assert.match(`${result.stdout}${result.stderr}`, /Blocked \/ Ready: Ready/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
