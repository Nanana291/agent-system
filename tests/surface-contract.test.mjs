import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'bin', 'agent-system.mjs');

function runAgent(args, cwd = repoRoot) {
  return spawnSync('node', [cli, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

test('release surface includes executable enforcement wrappers, aliases, and version 0.6.4.4', () => {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'agent-system.json'), 'utf8'));

  assert.equal(pkg.version, '0.6.4.4');
  assert.equal(pkg.scripts['luau-train'], 'node ./bin/agent-system.mjs luau-train');
  assert.equal(pkg.scripts['upgrade-status'], 'node ./bin/agent-system.mjs upgrade status');
  assert.equal(pkg.scripts.metrics, 'node ./bin/agent-system.mjs metrics');
  assert.equal(pkg.scripts['metrics-trend'], 'node ./bin/agent-system.mjs metrics trend');
  assert.equal(pkg.scripts['metrics-compare'], 'node ./bin/agent-system.mjs metrics compare');
  assert.equal(manifest.paths.metrics, 'docs/metrics');
  assert.equal(manifest.metrics.current, 'docs/metrics/current.json');
  assert.equal(manifest.metrics.history, 'docs/metrics/history.jsonl');
  assert.equal(manifest.metrics.readme, 'docs/metrics/README.md');
  assert.equal(manifest.metrics.snapshots, 'docs/metrics/snapshots');
  assert.equal(existsSync(path.join(repoRoot, 'bin', 'delivery-check.mjs')), true);
  assert.equal(existsSync(path.join(repoRoot, 'bin', 'upgrade-apply.mjs')), true);
  assert.equal(existsSync(path.join(repoRoot, 'bin', 'upgrade-sync.mjs')), true);
  assert.equal(existsSync(path.join(repoRoot, 'bin', 'upgrade-replay.mjs')), true);
  assert.equal(existsSync(path.join(repoRoot, 'bin', 'brain-query.mjs')), true);
  assert.equal(existsSync(path.join(repoRoot, 'bin', 'brain-dedupe.mjs')), true);
  assert.equal(existsSync(path.join(repoRoot, 'bin', 'backup-validate.mjs')), true);
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'metrics.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'metrics-trend.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'metrics-compare.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'upgrade-apply.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'upgrade-sync.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'upgrade-replay.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'brain-dedupe.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'delivery-check.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'docs', 'upgrade', 'README.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'docs', 'upgrade', 'current.json')), true);
  assert.equal(existsSync(path.join(repoRoot, 'docs', 'upgrade', 'history.jsonl')), true);
  assert.equal(existsSync(path.join(repoRoot, 'docs', 'upgrade', 'sessions', 'README.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'docs', 'metrics', 'README.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'docs', 'metrics', 'current.json')), true);
  assert.equal(existsSync(path.join(repoRoot, 'docs', 'metrics', 'history.jsonl')), true);
  assert.equal(existsSync(path.join(repoRoot, 'docs', 'metrics', 'snapshots', 'bootstrap.json')), true);
});

test('delivery-check is ready on the repository root workspace', () => {
  const result = runAgent(['delivery-check']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[DELIVERY GATE\]/);
  assert.match(result.stdout, /Blocked \/ Ready: Ready/);
});
