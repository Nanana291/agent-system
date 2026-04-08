import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'bin', 'agent-system.mjs');

function createWorkspace() {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-upgrade-'));
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

test('upgrade syncs multiple agent instructions and host memories directly', () => {
  const workspace = createWorkspace();
  try {
    writeFileSync(
      path.join(workspace, 'AGENTS.md'),
      `# Agent System

## Agent 1 — The Scriptmaster
- Owns logic.

## Agent 2 — The UI Designer
- Owns UI.

## Agent 21 — The Terminology Keeper
- Owns terminology.
`,
      'utf8',
    );

    const result = runAgent(['upgrade', '--host', 'qwen'], workspace);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[UPGRADE\]/);
    assert.match(result.stdout, /Agents upgraded: 3/);

    const agentsDoc = readFileSync(path.join(workspace, 'AGENTS.md'), 'utf8');
    assert.match(agentsDoc, /agent-system-upgrade-start/);
    assert.match(agentsDoc, /Scriptmaster/);
    assert.match(agentsDoc, /UI Designer/);
    assert.match(agentsDoc, /Terminology Keeper/);
    assert.equal((agentsDoc.match(/agent-system-upgrade-start/g) || []).length, 1);

    for (const host of ['claude', 'codex', 'qwen']) {
      const hostMemory = readFileSync(path.join(workspace, 'memory', 'host', `${host}.md`), 'utf8');
      assert.match(hostMemory, /Agent Upgrade Sync/);
      assert.match(hostMemory, /Scriptmaster/);
      assert.match(hostMemory, /UI Designer/);
      assert.match(hostMemory, /Terminology Keeper/);
      assert.match(hostMemory, new RegExp(`Host sync target: ${host}\\.`));
    }

    const profileMemory = readFileSync(path.join(workspace, 'memory', 'profile', 'imphub.md'), 'utf8');
    assert.match(profileMemory, /Agent Upgrade Sync/);
    assert.match(profileMemory, /qwen/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('upgrade is idempotent and replaces the existing sync block', () => {
  const workspace = createWorkspace();
  try {
    const first = runAgent(['upgrade'], workspace);
    assert.equal(first.status, 0, first.stderr);

    const second = runAgent(['upgrade'], workspace);
    assert.equal(second.status, 0, second.stderr);

    const agentsDoc = readFileSync(path.join(workspace, 'AGENTS.md'), 'utf8');
    assert.equal((agentsDoc.match(/agent-system-upgrade-start/g) || []).length, 1);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('upgrade preview inspects the target without writing any sync blocks', () => {
  const workspace = createWorkspace();
  try {
    writeFileSync(
      path.join(workspace, 'AGENTS.md'),
      `# Agent System

## Agent 1 — The Scriptmaster
- Owns logic.

## Agent 2 — The UI Designer
- Owns UI.
`,
      'utf8',
    );

    const result = runAgent(['upgrade', 'preview', '--host', 'qwen'], workspace);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[UPGRADE PREVIEW\]/);
    assert.match(result.stdout, /Agents upgraded: 2/);
    assert.equal(readFileSync(path.join(workspace, 'AGENTS.md'), 'utf8').includes('agent-system-upgrade-start'), false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('upgrade memory scopes the sync to memory layers only', () => {
  const workspace = createWorkspace();
  try {
    writeFileSync(
      path.join(workspace, 'AGENTS.md'),
      `# Agent System

## Agent 1 — The Scriptmaster
- Owns logic.
`,
      'utf8',
    );

    const result = runAgent(['upgrade', 'memory', '--host', 'qwen'], workspace);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[UPGRADE\]/);
    assert.match(result.stdout, /Mode: memory/);

    const agentsDoc = readFileSync(path.join(workspace, 'AGENTS.md'), 'utf8');
    const profileMemory = readFileSync(path.join(workspace, 'memory', 'profile', 'imphub.md'), 'utf8');
    const hostMemory = readFileSync(path.join(workspace, 'memory', 'host', 'qwen.md'), 'utf8');

    assert.equal(agentsDoc.includes('agent-system-upgrade-start'), false);
    assert.match(profileMemory, /Agent Upgrade Sync/);
    assert.match(hostMemory, /Agent Upgrade Sync/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
