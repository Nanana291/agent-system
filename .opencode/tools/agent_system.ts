import { tool } from '@opencode-ai/plugin';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..', '..');
const cliPath = path.join(repoRoot, 'bin', 'agent-system.mjs');

function runAgentSystem(args: string[]) {
  const result = spawnSync('node', [cliPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  return {
    status: typeof result.status === 'number' ? result.status : 1,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    error: result.error ? (result.error instanceof Error ? result.error.message : String(result.error)) : '',
  };
}

function formatResult(command: string, result: ReturnType<typeof runAgentSystem>) {
  const lines = [`[agent-system ${command}]`, `exitCode: ${result.status}`];
  if (result.stdout) {
    lines.push('stdout:');
    lines.push(result.stdout);
  }
  if (result.stderr) {
    lines.push('stderr:');
    lines.push(result.stderr);
  }
  if (result.error) {
    lines.push('error:');
    lines.push(result.error);
  }
  return lines.join('\n');
}

export const validate = tool({
  description: 'Run the agent-system validation gate.',
  args: {},
  async execute() {
    return formatResult('validate', runAgentSystem(['validate']));
  },
});

export const route = tool({
  description: 'Route a task through the active agent-system profile.',
  args: {
    task: tool.schema.string().describe('Task text to classify and route'),
  },
  async execute(args) {
    return formatResult('route', runAgentSystem(['route', args.task]));
  },
});

export const upgradeStatus = tool({
  description: 'Show the current upgrade status and readiness.',
  args: {},
  async execute() {
    return formatResult('upgrade status', runAgentSystem(['upgrade', 'status']));
  },
});

export const deliveryCheck = tool({
  description: 'Run the delivery gate and report whether the workspace is ready.',
  args: {},
  async execute() {
    return formatResult('delivery-check', runAgentSystem(['delivery-check']));
  },
});

export const brainQuery = tool({
  description: 'Search the structured brain for a topic or lesson.',
  args: {
    query: tool.schema.string().describe('Brain query text'),
  },
  async execute(args) {
    return formatResult('brain query', runAgentSystem(['brain', 'query', args.query]));
  },
});

export const luauTrain = tool({
  description: 'Run the Luau-focused training path.',
  args: {},
  async execute() {
    return formatResult('luau-train', runAgentSystem(['luau-train']));
  },
});
