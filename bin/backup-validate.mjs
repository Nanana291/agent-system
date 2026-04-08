#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agent-system.mjs');
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [cli, 'bundle', 'validate', '--file', args[0] || ''], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
