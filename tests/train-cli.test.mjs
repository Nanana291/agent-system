import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'bin', 'agent-system.mjs');

function createWorkspace() {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-system-train-'));
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

test('train runs automatically and syncs training blocks across profile and host memory', () => {
  const workspace = createWorkspace();
  try {
    const result = runAgent(['train', '--host', 'qwen'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[TRAIN\]/);
    assert.match(result.stdout, /Mode: success/);
    assert.match(result.stdout, /Agents trained:/);

    const agentsDoc = readFileSync(path.join(workspace, 'AGENTS.md'), 'utf8');
    const profileDoc = readFileSync(path.join(workspace, 'profiles', 'imphub', 'AGENTS.md'), 'utf8');
    const profileMemory = readFileSync(path.join(workspace, 'memory', 'profile', 'imphub.md'), 'utf8');
    const hostMemory = readFileSync(path.join(workspace, 'memory', 'host', 'qwen.md'), 'utf8');
    const trainingCurrent = JSON.parse(readFileSync(path.join(workspace, 'docs', 'training', 'current.json'), 'utf8'));

    assert.equal((agentsDoc.match(/agent-system-training-start/g) || []).length, 1);
    assert.equal((profileDoc.match(/agent-system-training-start/g) || []).length, 1);
    assert.equal((profileMemory.match(/agent-system-training-start/g) || []).length, 1);
    assert.equal((hostMemory.match(/agent-system-training-start/g) || []).length, 1);
    assert.match(agentsDoc, /Training Sync/);
    assert.match(profileDoc, /Training Sync/);
    assert.match(profileMemory, /Agent Training Sync/);
    assert.match(hostMemory, /Agent Training Sync/);
    assert.equal(trainingCurrent.mode, 'success');
    assert.equal(trainingCurrent.activeHost, 'qwen');
    assert.equal(existsSync(path.join(workspace, 'docs', 'training', 'history.jsonl')), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('train error captures prevention rules without over-promoting them', () => {
  const workspace = createWorkspace();
  try {
    const result = runAgent(['train', 'error', '--host', 'qwen'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Mode: error/);
    assert.match(result.stdout, /Outcome: held/);

    const changeMemory = readFileSync(path.join(workspace, 'memory', 'change', 'qwen.md'), 'utf8');
    const hostMemory = readFileSync(path.join(workspace, 'memory', 'host', 'qwen.md'), 'utf8');
    const trainingCurrent = JSON.parse(readFileSync(path.join(workspace, 'docs', 'training', 'current.json'), 'utf8'));

    assert.match(changeMemory, /Prevention rule/);
    assert.match(hostMemory, /Training Sync/);
    assert.equal(trainingCurrent.mode, 'error');
    assert.equal(trainingCurrent.outcome, 'held');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('train replay reuses the latest lesson without duplicating sync blocks', () => {
  const workspace = createWorkspace();
  try {
    const first = runAgent(['train', '--host', 'qwen'], workspace);
    assert.equal(first.status, 0, first.stderr);

    const replay = runAgent(['train', 'replay', '--host', 'qwen'], workspace);
    assert.equal(replay.status, 0, replay.stderr);
    assert.match(replay.stdout, /Mode: replay/);

    const agentsDoc = readFileSync(path.join(workspace, 'AGENTS.md'), 'utf8');
    const profileDoc = readFileSync(path.join(workspace, 'profiles', 'imphub', 'AGENTS.md'), 'utf8');
    const history = readFileSync(path.join(workspace, 'docs', 'training', 'history.jsonl'), 'utf8');

    assert.equal((agentsDoc.match(/agent-system-training-start/g) || []).length, 1);
    assert.equal((profileDoc.match(/agent-system-training-start/g) || []).length, 1);
    assert.equal(history.trim().split(/\r?\n/).filter(Boolean).length, 2);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('train auto-promotes repeated lessons and writes a continuous summary', () => {
  const workspace = createWorkspace();
  try {
    cpSync(path.join(repoRoot, 'memory'), path.join(workspace, 'memory'), { recursive: true });
    const changeMemory = path.join(workspace, 'memory', 'change', 'qwen.md');
    writeFileSync(changeMemory, '# Qwen Change Memory\n\n- Keep route fallback deterministic.\n- Keep route fallback deterministic.\n', 'utf8');

    const result = runAgent(['train', '--host', 'qwen'], workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Auto promotion:/);
    assert.match(result.stdout, /Continuous summary:/);

    const hostMemory = readFileSync(path.join(workspace, 'memory', 'host', 'qwen.md'), 'utf8');
    const continuousCurrent = JSON.parse(readFileSync(path.join(workspace, 'docs', 'training', 'continuous.json'), 'utf8'));
    const continuousDoc = readFileSync(path.join(workspace, 'docs', 'training', 'continuous.md'), 'utf8');

    assert.match(hostMemory, /Keep route fallback deterministic/);
    assert.equal(continuousCurrent.promotedMemory > 0, true);
    assert.match(continuousDoc, /Continuous Training/);
    assert.match(continuousDoc, /Auto promotion/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('train explain and compare keep history separated by host', () => {
  const workspace = createWorkspace();
  try {
    const first = runAgent(['train', '--host', 'qwen'], workspace);
    assert.equal(first.status, 0, first.stderr);
    const second = runAgent(['train', '--host', 'qwen'], workspace);
    assert.equal(second.status, 0, second.stderr);
    const claude = runAgent(['train', '--host', 'claude'], workspace);
    assert.equal(claude.status, 0, claude.stderr);

    const explain = runAgent(['train', 'explain', '--host', 'qwen'], workspace);
    assert.equal(explain.status, 0, explain.stderr);
    assert.match(explain.stdout, /\[TRAIN EXPLAIN\]/);
    assert.match(explain.stdout, /Host: qwen/);
    assert.match(explain.stdout, /History: docs\/training\/explain\/qwen\.jsonl/);

    const claudeExplain = runAgent(['train', 'explain', '--host', 'claude'], workspace);
    assert.equal(claudeExplain.status, 0, claudeExplain.stderr);
    assert.match(claudeExplain.stdout, /Host: claude/);
    assert.match(claudeExplain.stdout, /History: docs\/training\/explain\/claude\.jsonl/);

    const compare = runAgent(['train', 'compare', '--host', 'qwen'], workspace);
    assert.equal(compare.status, 0, compare.stderr);
    assert.match(compare.stdout, /\[TRAIN COMPARE\]/);
    assert.match(compare.stdout, /Host: qwen/);
    assert.match(compare.stdout, /History: docs\/training\/compare\/qwen\.jsonl/);

    const qwenExplainHistory = readFileSync(path.join(workspace, 'docs', 'training', 'explain', 'qwen.jsonl'), 'utf8');
    const claudeExplainHistory = readFileSync(path.join(workspace, 'docs', 'training', 'explain', 'claude.jsonl'), 'utf8');
    const qwenCompareHistory = readFileSync(path.join(workspace, 'docs', 'training', 'compare', 'qwen.jsonl'), 'utf8');

    assert.equal(qwenExplainHistory.trim().split(/\r?\n/).filter(Boolean).length >= 1, true);
    assert.equal(claudeExplainHistory.trim().split(/\r?\n/).filter(Boolean).length >= 1, true);
    assert.equal(qwenCompareHistory.trim().split(/\r?\n/).filter(Boolean).length >= 1, true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('train generates a training pack after enough host cycles', () => {
  const workspace = createWorkspace();
  try {
    const first = runAgent(['train', '--host', 'qwen'], workspace);
    assert.equal(first.status, 0, first.stderr);
    const second = runAgent(['train', '--host', 'qwen'], workspace);
    assert.equal(second.status, 0, second.stderr);
    const third = runAgent(['train', '--host', 'qwen'], workspace);
    assert.equal(third.status, 0, third.stderr);

    assert.match(third.stdout, /Training pack:/);
    const packPath = path.join(workspace, 'docs', 'training', 'packs', 'qwen.md');
    const packDoc = readFileSync(packPath, 'utf8');
    assert.match(packDoc, /# Training Pack/);
    assert.match(packDoc, /Host: qwen/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
