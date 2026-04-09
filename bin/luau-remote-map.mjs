#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agent-system.mjs');
const result = spawnSync(process.execPath, [cli, 'luau-remote-map', ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
