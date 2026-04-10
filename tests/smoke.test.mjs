#!/usr/bin/env node
/**
 * Smoke tests for agent-system CLI
 * Run: node tests/smoke.test.mjs
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, '..', 'bin', 'agent-system.mjs');
const WORKSPACE = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function run(args, opts = {}) {
  const result = spawnSync('node', [CLI, ...args], {
    cwd: opts.cwd || WORKSPACE,
    timeout: opts.timeout || 10000,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status ?? 1,
    timedOut: result.signal === 'SIGTERM',
  };
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ─── Tests ───

console.log('\n── Core Commands ─────────────────────────────');

test('version prints version', () => {
  const r = run(['version']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('agent-system v'), 'missing version prefix');
});

test('doctor runs without crash', () => {
  const r = run(['doctor']);
  assert(r.exitCode === 0 || r.exitCode === 1, `unexpected exit ${r.exitCode}`);
  assert(r.stdout.includes('AGENT SYSTEM DOCTOR'), 'missing doctor header');
});

test('lock prints task lock', () => {
  const r = run(['lock', 'test-task']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('TASK LOCK'), 'missing lock header');
});

test('route prints route', () => {
  const r = run(['route']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('Profile:'), 'missing profile');
});

test('profile prints profile', () => {
  const r = run(['profile']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('Profile:'), 'missing profile');
});

test('gate prints delivery gate', () => {
  const r = run(['gate']);
  assert(r.exitCode === 0 || r.exitCode === 1, `exit ${r.exitCode}`);
  assert(r.stdout.includes('DELIVERY GATE') || r.stderr.includes('DELIVERY GATE'), 'missing gate header');
});

test('status prints agent status', () => {
  const r = run(['status']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('[AGENT]'), 'missing agent header');
});

test('dashboard prints health', () => {
  const r = run(['dashboard']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('Overall Health'), 'missing health');
});

console.log('\n── Brain Commands ────────────────────────────');

test('brain list works', () => {
  const r = run(['brain', 'list']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('[BRAIN LIST]'), 'missing list header');
});

test('brain stats works', () => {
  const r = run(['brain', 'stats']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('[BRAIN STATS]'), 'missing stats header');
});

test('brain sync works', () => {
  const r = run(['brain', 'sync']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('[BRAIN SYNC]'), 'missing sync header');
});

test('brain add works', () => {
  const r = run(['brain', 'add', '--title', 'smoke-test', '--body', 'test', '--tag', 'test']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('[BRAIN ADD]'), 'missing add header');
});

console.log('\n── Memory Commands ───────────────────────────');

test('memory status works', () => {
  const r = run(['memory', 'status']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('Files:'), 'missing files count');
});

test('memory review works', () => {
  const r = run(['memory', 'review']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('[MEMORY REVIEW]'), 'missing review header');
});

test('memory compress works', () => {
  const r = run(['memory', 'compress']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('[MEMORY COMPRESS]'), 'missing compress header');
});

console.log('\n── Upgrade Commands ──────────────────────────');

test('upgrade status works', () => {
  const r = run(['upgrade', 'status']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('[UPGRADE REPORT]'), 'missing report header');
});

test('upgrade profile works', () => {
  const r = run(['upgrade', 'profile', 'AGENTS.md']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('[UPGRADE]'), 'missing upgrade header');
});

console.log('\n── Luau Commands ─────────────────────────────');

test('luau-inspect works', () => {
  const r = run(['luau-inspect', 'AGENTS.md']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('[LUAU INSPECT]'), 'missing inspect header');
});

test('luau-perf-profile works', () => {
  const r = run(['luau-perf-profile', 'AGENTS.md']);
  assert(r.exitCode === 0 || r.exitCode === 1, `exit ${r.exitCode}`);
  assert(r.stdout.includes('[LUAU PERF PROFILE]'), 'missing profile header');
});

test('luau-dead-code works', () => {
  const r = run(['luau-dead-code', 'AGENTS.md']);
  assert(r.exitCode === 0, `exit ${r.exitCode}`);
  assert(r.stdout.includes('[LUAU DEAD CODE]'), 'missing dead code header');
});

test('luau-pcall-audit works', () => {
  const r = run(['luau-pcall-audit', 'AGENTS.md']);
  assert(r.exitCode === 0 || r.exitCode === 1, `exit ${r.exitCode}`);
  assert(r.stdout.includes('[LUAU PCALL AUDIT]'), 'missing audit header');
});

test('luau-verify-flow works', () => {
  const r = run(['luau-verify-flow', 'AGENTS.md']);
  assert(r.exitCode === 0 || r.exitCode === 1, `exit ${r.exitCode}`);
  assert(r.stdout.includes('[LUAU VERIFY FLOW]'), 'missing verify header');
});

console.log('\n── Project Commands ──────────────────────────');

test('project-lint works', () => {
  const r = run(['project-lint']);
  assert(r.exitCode === 0 || r.exitCode === 1, `exit ${r.exitCode}`);
  assert(r.stdout.includes('[PROJECT LINT]'), 'missing lint header');
});

// ─── Summary ───

console.log('\n════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failures.length > 0) {
  console.log('\n── Failures ──────────────────────────────────');
  for (const f of failures) {
    console.log(`  ❌ ${f.name}: ${f.error}`);
  }
}
console.log('════════════════════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
