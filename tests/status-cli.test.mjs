import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'bin', 'agent-system.mjs');

function createWorkspace() {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-status-'));
  cpSync(path.join(repoRoot, 'agent-system.json'), path.join(dir, 'agent-system.json'));
  cpSync(path.join(repoRoot, 'status'), path.join(dir, 'status'), { recursive: true });
  cpSync(path.join(repoRoot, 'docs'), path.join(dir, 'docs'), { recursive: true });
  cpSync(path.join(repoRoot, 'bin'), path.join(dir, 'bin'), { recursive: true });
  cpSync(path.join(repoRoot, 'memory'), path.join(dir, 'memory'), { recursive: true });
  cpSync(path.join(repoRoot, 'profiles'), path.join(dir, 'profiles'), { recursive: true });
  cpSync(path.join(repoRoot, 'templates'), path.join(dir, 'templates'), { recursive: true });
  cpSync(path.join(repoRoot, 'README.md'), path.join(dir, 'README.md'));
  cpSync(path.join(repoRoot, 'AGENTS.md'), path.join(dir, 'AGENTS.md'));
  writeFileSync(
    path.join(dir, 'status', 'current.json'),
    JSON.stringify({
      agent: null,
      name: 'Idle',
      action: 'No active agent',
      state: 'idle',
      scope: 'none',
      task: null,
      route: null,
      profile: null,
      attachedAt: null,
      heartbeatAt: null,
      startedAt: null,
      updatedAt: null,
      eta: null,
      detail: '',
      active: false,
    }, null, 2) + '\n',
    'utf8',
  );
  writeFileSync(path.join(dir, 'status', 'events.jsonl'), '', 'utf8');
  return dir;
}

function runStatus(args, cwd) {
  return spawnSync('node', [cli, 'status', ...args], {
    cwd,
    encoding: 'utf8',
  });
}

test('status show renders the current presence line', () => {
  const workspace = createWorkspace();
  try {
    const result = runStatus(['show'], workspace);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[AGENT\]\s+Idle\s+\|\s+No active agent\s+\|\s+00:00 elapsed/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('status set updates the snapshot and list shows the event', () => {
  const workspace = createWorkspace();
  try {
    const setResult = runStatus([
      'set',
      '--agent', 'ghost',
      '--name', 'Ghost',
      '--action', 'Waiting for ghost to finish auto farm',
      '--state', 'working',
      '--scope', 'farm-loop',
      '--eta', '08:00',
    ], workspace);

    assert.equal(setResult.status, 0, setResult.stderr);
    assert.match(setResult.stdout, /\[AGENT\]\s+Ghost\s+\|\s+Waiting for ghost to finish auto farm/);

    const showResult = runStatus(['show'], workspace);
    assert.equal(showResult.status, 0, showResult.stderr);
    assert.match(showResult.stdout, /\[AGENT\]\s+Ghost\s+\|\s+Waiting for ghost to finish auto farm/);

    const listResult = runStatus(['list', '--limit', '5'], workspace);
    assert.equal(listResult.status, 0, listResult.stderr);
    assert.match(listResult.stdout, /\[AGENT\]\s+Ghost\s+\|\s+Waiting for ghost to finish auto farm/);

    const current = JSON.parse(readFileSync(path.join(workspace, 'status', 'current.json'), 'utf8'));
    assert.equal(current.agent, 'ghost');
    assert.equal(current.active, true);
    assert.equal(current.scope, 'farm-loop');
    assert.equal(existsSync(path.join(workspace, 'status', 'events.jsonl')), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('status clear returns the workspace to idle', () => {
  const workspace = createWorkspace();
  try {
    const setResult = runStatus([
      'set',
      '--agent', 'ghost',
      '--name', 'Ghost',
      '--action', 'Waiting for ghost to finish auto farm',
      '--state', 'working',
      '--scope', 'farm-loop',
      '--eta', '08:00',
    ], workspace);

    assert.equal(setResult.status, 0, setResult.stderr);

    const clearResult = runStatus(['clear'], workspace);
    assert.equal(clearResult.status, 0, clearResult.stderr);
    assert.match(clearResult.stdout, /\[AGENT\]\s+Idle\s+\|\s+No active agent\s+\|\s+00:00 elapsed/);

    const current = JSON.parse(readFileSync(path.join(workspace, 'status', 'current.json'), 'utf8'));
    assert.equal(current.active, false);
    assert.equal(current.name, 'Idle');

    const listResult = runStatus(['list', '--limit', '5'], workspace);
    assert.equal(listResult.status, 0, listResult.stderr);
    assert.match(listResult.stdout, /\[AGENT\]\s+Idle\s+\|\s+No active agent/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('status set infers a readable name from the agent id', () => {
  const workspace = createWorkspace();
  try {
    const result = runStatus([
      'set',
      '--agent', 'ghost',
      '--action', 'Waiting for ghost to finish auto farm',
      '--state', 'working',
      '--scope', 'farm-loop',
    ], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[AGENT\]\s+Ghost\s+\|\s+Waiting for ghost to finish auto farm/);

    const current = JSON.parse(readFileSync(path.join(workspace, 'status', 'current.json'), 'utf8'));
    assert.equal(current.name, 'Ghost');
    assert.equal(current.agent, 'ghost');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('status heartbeat refreshes the snapshot without changing the message', async () => {
  const workspace = createWorkspace();
  try {
    const setResult = runStatus([
      'set',
      '--agent', 'ghost',
      '--action', 'Waiting for ghost to finish auto farm',
      '--state', 'working',
      '--scope', 'farm-loop',
    ], workspace);

    assert.equal(setResult.status, 0, setResult.stderr);
    const before = JSON.parse(readFileSync(path.join(workspace, 'status', 'current.json'), 'utf8'));

    await delay(10);
    const heartbeatResult = runStatus(['heartbeat'], workspace);
    assert.equal(heartbeatResult.status, 0, heartbeatResult.stderr);
    assert.match(heartbeatResult.stdout, /\[AGENT\]\s+Ghost\s+\|\s+Waiting for ghost to finish auto farm/);

    const current = JSON.parse(readFileSync(path.join(workspace, 'status', 'current.json'), 'utf8'));
    assert.equal(current.agent, 'ghost');
    assert.equal(current.action, before.action);
    assert.equal(current.heartbeatAt !== null, true);
    assert.equal(current.updatedAt !== before.updatedAt, true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('status attach binds a task route and profile to the current session', () => {
  const workspace = createWorkspace();
  try {
    const result = runStatus([
      'attach',
      '--agent', 'ghost',
      '--task', 'memory audit',
      '--route', 'memory -> audit',
    ], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[AGENT\]\s+Ghost\s+\|\s+Attached to memory audit/);
    assert.match(result.stdout, /task=memory audit/);
    assert.match(result.stdout, /route=memory -> audit/);

    const current = JSON.parse(readFileSync(path.join(workspace, 'status', 'current.json'), 'utf8'));
    assert.equal(current.agent, 'ghost');
    assert.equal(current.task, 'memory audit');
    assert.equal(current.route, 'memory -> audit');
    assert.equal(current.profile, 'imphub');
    assert.equal(current.scope, 'audit');
    assert.equal(current.active, true);
    assert.ok(current.attachedAt);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('status who reports the active session summary', () => {
  const workspace = createWorkspace();
  try {
    const attachResult = runStatus([
      'attach',
      '--agent', 'ghost',
      '--task', 'route sync',
      '--route', 'status -> watch',
    ], workspace);

    assert.equal(attachResult.status, 0, attachResult.stderr);

    const whoResult = runStatus(['who'], workspace);
    assert.equal(whoResult.status, 0, whoResult.stderr);
    assert.match(whoResult.stdout, /\[AGENT\]\s+Ghost\s+\|\s+Attached to route sync/);
    assert.match(whoResult.stdout, /task=route sync/);
    assert.match(whoResult.stdout, /route=status -> watch/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
