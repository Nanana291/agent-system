import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'bin', 'agent-system.mjs');

function createWorkspace() {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-memory-'));
  cpSync(path.join(repoRoot, 'agent-system.json'), path.join(dir, 'agent-system.json'));
  cpSync(path.join(repoRoot, 'bin'), path.join(dir, 'bin'), { recursive: true });
  cpSync(path.join(repoRoot, 'docs'), path.join(dir, 'docs'), { recursive: true });
  cpSync(path.join(repoRoot, 'memory'), path.join(dir, 'memory'), { recursive: true });
  cpSync(path.join(repoRoot, 'profiles'), path.join(dir, 'profiles'), { recursive: true });
  cpSync(path.join(repoRoot, 'templates'), path.join(dir, 'templates'), { recursive: true });
  cpSync(path.join(repoRoot, 'README.md'), path.join(dir, 'README.md'));
  cpSync(path.join(repoRoot, 'AGENTS.md'), path.join(dir, 'AGENTS.md'));
  cpSync(path.join(repoRoot, 'status'), path.join(dir, 'status'), { recursive: true });
  return dir;
}

function runMemory(args, cwd) {
  return spawnSync('node', [cli, 'memory', ...args], {
    cwd,
    encoding: 'utf8',
  });
}

test('memory review and compress stay inside the active host memory', () => {
  const workspace = createWorkspace();
  try {
    writeFileSync(
      path.join(workspace, 'memory', 'change', 'qwen.md'),
      '# Qwen Change Memory\n\n- Gate passed for update change targeting bin/agent-system.mjs.\n- Gate passed for update change targeting bin/agent-system.mjs.\n- Keep host memory flat.\n',
      'utf8',
    );

    const result = runMemory(['review', '--host', 'qwen'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[MEMORY REVIEW\]/);
    assert.match(result.stdout, /Host: qwen/);
    assert.match(result.stdout, /Duplicate lessons:/);
    assert.match(result.stdout, /Compression candidates:/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('memory teach and memory gate produce a compact host pack', () => {
  const workspace = createWorkspace();
  try {
    writeFileSync(
      path.join(workspace, 'memory', 'change', 'claude.md'),
      '# Claude Change Memory\n\n- Gate passed for update change targeting bin/agent-system.mjs.\n- Use a host-local file for durable lessons.\n',
      'utf8',
    );

    const gate = runMemory(['gate', '--host', 'claude'], workspace);
    assert.equal(gate.status, 0, gate.stderr);
    assert.match(gate.stdout, /\[MEMORY GATE\]/);

    const teach = runMemory(['teach', '--host', 'claude'], workspace);
    assert.equal(teach.status, 0, teach.stderr);
    assert.match(teach.stdout, /\[MEMORY TEACH\]/);
    assert.match(teach.stdout, /memory\/host\/claude\.md/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('memory packs generate and list stay host-local', () => {
  const workspace = createWorkspace();
  try {
    const generate = runMemory(['packs', 'generate', '--host', 'qwen'], workspace);
    assert.equal(generate.status, 0, generate.stderr);
    assert.match(generate.stdout, /\[LEARNING PACKS\]/);
    assert.match(generate.stdout, /memory\/packs\/qwen\.md/);

    const list = runMemory(['packs', 'list', '--host', 'qwen'], workspace);
    assert.equal(list.status, 0, list.stderr);
    assert.match(list.stdout, /memory\/packs\/qwen\.md/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('memory reflect records a host-local lesson without crossing hosts', () => {
  const workspace = createWorkspace();
  try {
    const result = runMemory(['reflect', '--host', 'codex'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[MEMORY REFLECT\]/);
    assert.match(result.stdout, /Host: codex/);
    assert.match(result.stdout, /memory\/change\/codex\.md/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('memory gate auto-demotes weak host lessons into change memory', () => {
  const workspace = createWorkspace();
  try {
    writeFileSync(
      path.join(workspace, 'memory', 'host', 'qwen.md'),
      '# Qwen Host Memory\n\n- Fix later.\n- Keep route fallback deterministic.\n',
      'utf8',
    );

    const result = runMemory(['gate', '--host', 'qwen'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[MEMORY GATE\]/);
    assert.match(result.stdout, /Demoted:/);

    const hostMemory = readFileSync(path.join(workspace, 'memory', 'host', 'qwen.md'), 'utf8');
    const changeMemory = readFileSync(path.join(workspace, 'memory', 'change', 'qwen.md'), 'utf8');

    assert.doesNotMatch(hostMemory, /Fix later\./);
    assert.match(changeMemory, /Demoted lesson/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
