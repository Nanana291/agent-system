import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

test('metrics surface exposes package scripts, manifest paths, and docs', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('agent-system.json');
  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const agents = readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');

  assert.equal(pkg.scripts.metrics, 'node ./bin/agent-system.mjs metrics');
  assert.equal(pkg.scripts['metrics-trend'], 'node ./bin/agent-system.mjs metrics trend');
  assert.equal(pkg.scripts['metrics-compare'], 'node ./bin/agent-system.mjs metrics compare');
  assert.equal(manifest.paths.metrics, 'docs/metrics');
  assert.equal(manifest.metrics.current, 'docs/metrics/current.json');
  assert.equal(manifest.metrics.history, 'docs/metrics/history.jsonl');
  assert.equal(manifest.metrics.readme, 'docs/metrics/README.md');
  assert.equal(manifest.metrics.snapshots, 'docs/metrics/snapshots');
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'metrics.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'metrics-trend.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'commands', 'metrics-compare.md')), true);
  assert.equal(existsSync(path.join(repoRoot, 'docs', 'metrics', 'README.md')), true);
  assert.match(readme, /docs\/metrics\/current\.json/);
  assert.match(agents, /docs\/metrics\/current\.json/);
});
