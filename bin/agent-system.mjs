#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});

async function main() {
  const { command, flags, positional } = parseArgs(process.argv.slice(2));
  if (!command || flags.help) {
    printHelp();
    return;
  }

  const workspace = loadWorkspace(flags.profile);

  switch (command) {
    case 'validate':
      handleValidate(workspace);
      return;
    case 'lint':
      handleLint(workspace);
      return;
    case 'route':
      printRouteSummary(workspace.profile, await readTaskText(positional));
      return;
    case 'explain':
      printRouteSummary(workspace.profile, await readTaskText(positional), true);
      return;
    case 'gate':
      handleGate(await readGateText(positional, flags));
      return;
    case 'profile':
      printProfile(workspace);
      return;
    case 'sync':
      handleSync(workspace, flags.write);
      return;
    case 'init':
      handleInit(workspace, positional);
      return;
    case 'memory':
      handleMemory(workspace, flags, positional);
      return;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  let command = '';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!command && !arg.startsWith('-')) {
      command = arg;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      flags.help = true;
      continue;
    }
    if (arg === '--write') {
      flags.write = true;
      continue;
    }
    if (arg === '--profile') {
      flags.profile = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--file' || arg === '-f') {
      flags.files = flags.files || [];
      flags.files.push(argv[i + 1]);
      i += 1;
      continue;
    }
    positional.push(arg);
  }

  return { command, flags, positional };
}

function printHelp() {
  console.log([
    'agent-system <command> [args]',
    '',
    'Commands:',
    '  validate   Check agent-system.json, active profile files, and required docs',
    '  route      Print a compact route summary for task text',
    '  explain    Print the same route summary with a short reason line',
    '  gate       Validate [DELIVERY GATE] fields from markdown input or repo files',
    '  profile    Show active profile metadata',
    '  sync       Validate or regenerate profiles/<profile>/AGENTS.md',
    '  lint       Run the full repository consistency check',
    '  init       Create a new profile from the active profile template',
    '  memory    Read or update layered memory files',
    '',
    'Flags:',
    '  --profile <name>  Override the active profile',
    '  --file <path>     Read gate markdown from explicit file(s)',
    '  --write           Write regenerated profile markdown during sync',
    '  --help            Show this message',
  ].join('\n'));
}

function loadWorkspace(profileName) {
  const repoRoot = findRepoRoot(process.cwd()) || findRepoRoot(scriptDir);
  const manifestPath = path.join(repoRoot, 'agent-system.json');
  const manifest = readJson(manifestPath);
  const activeProfileName = profileName || manifest.profileDiscovery?.defaultProfile;
  const profileDir = path.join(repoRoot, 'profiles', activeProfileName);
  const profilePath = path.join(profileDir, 'profile.json');
  const profileDocPath = path.join(profileDir, 'AGENTS.md');
  const profile = fs.existsSync(profilePath) ? readJson(profilePath) : null;

  return {
    repoRoot,
    manifest,
    manifestPath,
    activeProfileName,
    profileDir,
    profilePath,
    profileDocPath,
    profile,
  };
}

function handleValidate(workspace) {
  const issues = [];
  const { repoRoot, manifest, profile, profilePath, profileDocPath } = workspace;

  if (!fs.existsSync(path.join(repoRoot, 'agent-system.json'))) {
    issues.push('missing agent-system.json');
  }
  if (!profile) {
    issues.push(`missing active profile JSON: ${path.relative(repoRoot, profilePath)}`);
  }
  if (!fs.existsSync(profileDocPath)) {
    issues.push(`missing active profile markdown: ${path.relative(repoRoot, profileDocPath)}`);
  }

  for (const file of manifest.bootstrap?.primaryDocs || []) {
    if (!fs.existsSync(path.join(repoRoot, file))) {
      issues.push(`missing bootstrap doc: ${file}`);
    }
  }

  for (const file of Object.values(manifest.bootstrap?.hostDocs || {})) {
    if (!fs.existsSync(path.join(repoRoot, file))) {
      issues.push(`missing host doc: ${file}`);
    }
  }

  for (const file of Object.values(manifest.artifacts || {})) {
    if (!fs.existsSync(path.join(repoRoot, file))) {
      issues.push(`missing artifact template: ${file}`);
    }
  }

  for (const dir of Object.values(manifest.paths || {})) {
    if (!fs.existsSync(path.join(repoRoot, dir))) {
      issues.push(`missing required directory: ${dir}`);
    }
  }

  const memoryPaths = [
    manifest.memory?.system,
    manifest.memory?.host?.generic,
    manifest.memory?.host?.claude,
    manifest.memory?.host?.codex,
    manifest.memory?.host?.qwen,
    profile?.memory?.profileMemory,
  ].filter(Boolean);

  for (const file of memoryPaths) {
    if (!fs.existsSync(path.join(repoRoot, file))) {
      issues.push(`missing memory file: ${file}`);
    }
  }

  if (issues.length === 0) {
    console.log('Validation: OK');
    return;
  }

  console.log('Validation: FAILED');
  for (const issue of issues) {
    console.log(`- ${issue}`);
  }
  process.exit(1);
}

function handleLint(workspace) {
  const report = buildLintReport(workspace);
  console.log('Lint: ' + (report.ok ? 'OK' : 'FAILED'));
  for (const item of report.items) {
    console.log(`- ${item}`);
  }
  process.exit(report.ok ? 0 : 1);
}

async function readTaskText(positional) {
  if (positional.length > 0) {
    return positional.join(' ');
  }
  return readStdin();
}

async function readGateText(positional, flags) {
  if (flags.files && flags.files.length > 0) {
    return flags.files.map((file) => fs.readFileSync(file, 'utf8')).join('\n\n');
  }
  if (positional.length > 0) {
    const text = positional.join(' ');
    if (fs.existsSync(text) && fs.statSync(text).isFile()) {
      return fs.readFileSync(text, 'utf8');
    }
    return text;
  }

  const stdinText = await readStdin();
  if (stdinText.trim()) {
    return stdinText;
  }

  return collectGateBlocks(process.cwd()).join('\n\n');
}

function handleGate(text) {
  const block = parseDeliveryGate(text);
  if (!block) {
    console.error('No [DELIVERY GATE] block found.');
    process.exit(1);
  }

  const missing = requiredGateFields.filter((field) => !isFilled(block[field]));
  console.log('[DELIVERY GATE]');
  for (const field of requiredGateFields) {
    console.log(`${field}: ${block[field] || ''}`);
  }
  console.log(`Blocked / Ready: ${missing.length === 0 ? 'Ready' : 'Blocked'}`);
  if (missing.length > 0) {
    console.log(`Missing fields: ${missing.join(', ')}`);
    process.exit(1);
  }
}

function printProfile(workspace) {
  const { manifest, activeProfileName, profile } = workspace;
  console.log(`Profile: ${activeProfileName}`);
  console.log(`Name: ${profile?.name || 'unknown'}`);
  console.log(`Status: ${profile?.status || 'unknown'}`);
  console.log(`Supported hosts: ${(profile?.supportedHosts || []).join(', ')}`);
  console.log(`Task types: ${Object.keys(profile?.taskTypes || {}).length}`);
  console.log(`Classifications: ${(profile?.classifications || []).join(', ')}`);
  console.log(`Required artifacts: ${(profile?.requiredArtifacts || Object.keys(manifest.artifacts || {})).join(', ')}`);
  console.log(`Review agents: ${(profile?.reviewAgents || []).join(', ')}`);
  console.log(`Memory: ${profile?.memory?.profileMemory || 'n/a'}`);
  console.log(`Source: ${path.relative(workspace.repoRoot, workspace.profilePath)}, ${path.relative(workspace.repoRoot, workspace.profileDocPath)}`);
}

function handleInit(workspace, positional) {
  const profileName = positional[0];
  if (!profileName) {
    console.error('Usage: agent-system init <profile-name>');
    process.exit(1);
  }

  const targetDir = path.join(workspace.repoRoot, 'profiles', profileName);
  const targetProfilePath = path.join(targetDir, 'profile.json');
  const targetDocPath = path.join(targetDir, 'AGENTS.md');
  const template = cloneProfileTemplate(workspace.profile, profileName);

  if (fs.existsSync(targetProfilePath) || fs.existsSync(targetDocPath)) {
    console.error(`Profile already exists: ${profileName}`);
    process.exit(1);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(targetProfilePath, JSON.stringify(template, null, 2) + '\n', 'utf8');
  fs.writeFileSync(targetDocPath, renderProfileDoc({ ...template, sourceOfTruth: { structured: path.relative(workspace.repoRoot, targetProfilePath), human: path.relative(workspace.repoRoot, targetDocPath) } }, workspace.manifest), 'utf8');
  ensureMemoryProfileFile(workspace.repoRoot, profileName);
  console.log(`Initialized profile: ${profileName}`);
}

function handleMemory(workspace, flags, positional) {
  const action = positional[0];
  const target = positional[1] || workspace.activeProfileName;
  if (!action) {
    console.error('Usage: agent-system memory <list|add> [target] [text]');
    process.exit(1);
  }

  if (action === 'list') {
    console.log(listMemoryFiles(workspace.repoRoot, target).join('\n'));
    return;
  }

  if (action === 'add') {
    const text = positional.slice(2).join(' ').trim();
    if (!text) {
      console.error('Usage: agent-system memory add <system|profile|host[:name]> <text>');
      process.exit(1);
    }
    const filePath = resolveMemoryTarget(workspace.repoRoot, target);
    appendMemoryEntry(filePath, text);
    console.log(`Updated ${path.relative(workspace.repoRoot, filePath)}`);
    return;
  }

  console.error(`Unknown memory action: ${action}`);
  process.exit(1);
}

function printRouteSummary(profile, taskText, explain = false) {
  const selection = selectTaskType(profile, taskText);
  console.log(`Profile: ${profile.profile} (${profile.name})`);
  console.log(`Task type: ${selection.taskType}`);
  console.log(`Route: ${selection.route.join(' -> ') || 'n/a'}`);
  console.log(`Skills: ${selection.requiredSkills.join(', ') || 'n/a'}`);
  console.log(`Artifacts: ${selection.requiredArtifacts.join(', ') || 'n/a'}`);
  console.log(`Tags: ${selection.tags.join(', ') || 'n/a'}`);
  if (explain) {
    console.log(`Why: ${selection.reason}`);
  }
}

function selectTaskType(profile, taskText) {
  const entries = Object.entries(profile.taskTypes || {});
  const input = normalize(taskText);
  let best = null;

  for (const [taskType, spec] of entries) {
    const score = scoreTask(taskType, spec, input);
    if (!best || score > best.score) {
      best = { taskType, spec, score };
    }
  }

  if (!best || best.score === 0) {
    const fallbackKey = firstFallbackKey(profile);
    const fallbackType = profile.routeFallbacks?.[fallbackKey] || entries[0]?.[0] || '';
    const fallbackSpec = profile.taskTypes?.[fallbackType] || entries[0]?.[1] || {};
    return {
      taskType: fallbackType,
      route: fallbackSpec.route || [],
      requiredSkills: fallbackSpec.requiredSkills || [],
      requiredArtifacts: fallbackSpec.requiredArtifacts || [],
      tags: fallbackSpec.tags || [],
      reason: `fallback via ${fallbackKey || 'profile default'}`,
    };
  }

  return {
    taskType: best.taskType,
    route: best.spec.route || [],
    requiredSkills: best.spec.requiredSkills || [],
    requiredArtifacts: best.spec.requiredArtifacts || [],
    tags: best.spec.tags || [],
    reason: `matched ${best.taskType} from active profile`,
  };
}

function handleSync(workspace, write) {
  const generated = renderProfileDoc(workspace.profile, workspace.manifest);
  const current = fs.existsSync(workspace.profileDocPath) ? fs.readFileSync(workspace.profileDocPath, 'utf8') : '';
  const same = normalizeNewlines(current) === normalizeNewlines(generated);

  if (write) {
    fs.mkdirSync(path.dirname(workspace.profileDocPath), { recursive: true });
    fs.writeFileSync(workspace.profileDocPath, generated, 'utf8');
    console.log(`Wrote ${path.relative(workspace.repoRoot, workspace.profileDocPath)}`);
    return;
  }

  if (same) {
    console.log(`${path.relative(workspace.repoRoot, workspace.profileDocPath)} is in sync`);
    return;
  }

  console.log(`${path.relative(workspace.repoRoot, workspace.profileDocPath)} is out of sync`);
  console.log('Run `agent-system sync --write` to regenerate it.');
  process.exit(1);
}

function buildLintReport(workspace) {
  const items = [];
  const checks = [
    ['manifest JSON', () => !!workspace.manifest],
    ['default profile exists', () => fs.existsSync(path.join(workspace.repoRoot, 'profiles', workspace.activeProfileName, 'profile.json'))],
    ['profile doc in sync', () => normalizeNewlines(fs.readFileSync(workspace.profileDocPath, 'utf8')) === normalizeNewlines(renderProfileDoc(workspace.profile, workspace.manifest))],
    ['memory schema exists', () => fs.existsSync(path.join(workspace.repoRoot, workspace.manifest.memory?.schema || 'docs/memory-schema.md'))],
    ['system memory exists', () => fs.existsSync(path.join(workspace.repoRoot, workspace.manifest.memory?.system || 'memory/system.md'))],
  ];
  for (const [label, fn] of checks) {
    if (!fn()) items.push(label);
  }

  const routeIssues = [];
  for (const [taskType, spec] of Object.entries(workspace.profile.taskTypes || {})) {
    if (!Array.isArray(spec.route) || spec.route.length === 0) routeIssues.push(`task route missing: ${taskType}`);
    if (!Array.isArray(spec.requiredArtifacts) || spec.requiredArtifacts.length === 0) routeIssues.push(`task artifacts missing: ${taskType}`);
  }
  items.push(...routeIssues);

  return { ok: items.length === 0, items };
}

function cloneProfileTemplate(profile, nextName) {
  return {
    ...structuredCloneSafe(profile),
    profile: nextName,
    name: humanize(nextName),
    status: 'draft',
    description: `Profile pack for ${humanize(nextName)}.`,
    sourceOfTruth: {
      structured: `profiles/${nextName}/profile.json`,
      human: `profiles/${nextName}/AGENTS.md`,
    },
    memory: {
      profileMemory: `memory/profile/${nextName}.md`,
      hostMemory: profile.memory?.hostMemory || undefined,
      durabilityRule: 'When a mistake has a clear fix and prevention rule, record it in profile memory first.',
    },
  };
}

function ensureMemoryProfileFile(repoRoot, profileName) {
  const filePath = path.join(repoRoot, 'memory', 'profile', `${profileName}.md`);
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `# ${humanize(profileName)} Memory\n\nProfile-specific lessons and preferences for ${profileName} live here.\n`, 'utf8');
  }
}

function listMemoryFiles(repoRoot, target) {
  const files = [];
  if (target === 'system') {
    files.push('memory/system.md');
  } else if (target === 'profile') {
    files.push(...walkFiles(path.join(repoRoot, 'memory', 'profile')).map((file) => path.relative(repoRoot, file)));
  } else if (target.startsWith('host')) {
    files.push(...walkFiles(path.join(repoRoot, 'memory', 'host')).map((file) => path.relative(repoRoot, file)));
  } else {
    files.push('memory/system.md');
    files.push(...walkFiles(path.join(repoRoot, 'memory', 'profile')).map((file) => path.relative(repoRoot, file)));
    files.push(...walkFiles(path.join(repoRoot, 'memory', 'host')).map((file) => path.relative(repoRoot, file)));
  }
  return files;
}

function resolveMemoryTarget(repoRoot, target) {
  if (target === 'system') return path.join(repoRoot, 'memory', 'system.md');
  if (target === 'profile') return path.join(repoRoot, 'memory', 'profile', 'imphub.md');
  if (target.startsWith('host:')) {
    const host = target.split(':')[1];
    return path.join(repoRoot, 'memory', 'host', `${host}.md`);
  }
  return path.join(repoRoot, 'memory', 'system.md');
}

function appendMemoryEntry(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const next = `${current.trimEnd()}\n\n- ${text}\n`;
  fs.writeFileSync(filePath, next, 'utf8');
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function renderProfileDoc(profile, manifest) {
  const lines = [];
  lines.push(`# ${profile.name} Profile`);
  lines.push('');
  lines.push(`This profile pack is the human-facing companion to \`${profile.sourceOfTruth?.structured || 'profiles/<profile>/profile.json'}\`.`);
  lines.push('When the two differ, the JSON file is authoritative.');
  lines.push('');
  lines.push('## Authority Split');
  lines.push('');
  lines.push('- Superpowers decides how work is approached.');
  lines.push('- Agent System decides route, ownership, handoff, and delivery gates.');
  lines.push(`- This profile defines the ${profile.name} domain map and the profile-specific route families.`);
  lines.push('');
  lines.push('## Profile Scope');
  lines.push('');
  lines.push(`The \`${profile.profile}\` profile covers the task families defined in the manifest.`);
  lines.push('');
  for (const [taskType, spec] of Object.entries(profile.taskTypes || {})) {
    lines.push(`- ${humanize(taskType)} (\`${taskType}\`) - tags: ${(spec.tags || []).join(', ') || 'none'}`);
  }
  lines.push('');
  lines.push('## Route Families');
  lines.push('');
  lines.push('| Task type | Route | Primary domains |');
  lines.push('|---|---|---|');
  for (const [taskType, spec] of Object.entries(profile.taskTypes || {})) {
    lines.push(`| \`${taskType}\` | \`${(spec.route || []).join(' -> ')}\` | ${(spec.tags || []).join(', ') || 'none'} |`);
  }
  lines.push('');
  lines.push('## Ownership Rules');
  lines.push('');
  lines.push('- One active domain has one owner.');
  lines.push('- Existing-script updates keep untouched domains stable.');
  lines.push('- UI wording changes are owned by the UI and terminology domains, not by logic.');
  lines.push('- Compatibility changes must call out unsupported executor paths explicitly.');
  lines.push('- Regression-proof work must name the baseline or equivalent reference.');
  lines.push('');
  lines.push('## Required Artifacts');
  lines.push('');
  for (const artifact of profile.requiredArtifacts || Object.keys(manifest.artifacts || {})) {
    lines.push(`- \`${artifact}\``);
  }
  lines.push('');
  lines.push('## Review Agents');
  lines.push('');
  for (const agent of profile.reviewAgents || []) {
    lines.push(`- \`${agent}\``);
  }
  lines.push('');
  lines.push('## Route Fallbacks');
  lines.push('');
  lines.push('| Classification | Fallback task type |');
  lines.push('|---|---|');
  for (const [classification, fallback] of Object.entries(profile.routeFallbacks || {})) {
    lines.push(`| \`${classification}\` | \`${fallback}\` |`);
  }
  lines.push('');
  lines.push('## Host Notes');
  lines.push('');
  lines.push('- Claude, Codex, and Qwen all consume the same structured profile.');
  lines.push('- Host-specific behavior stays thin and should degrade to markdown artifacts when a capability is missing.');
  lines.push('- The profile data stays stable even if a host cannot execute every command form.');
  lines.push('');
  return lines.join('\n');
}

function parseDeliveryGate(text) {
  const source = String(text || '');
  const start = source.indexOf('[DELIVERY GATE]');
  if (start === -1) {
    return null;
  }
  const lines = source.slice(start).split(/\r?\n/);
  const block = {};
  for (const line of lines.slice(1)) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match && requiredGateFields.includes(match[1].trim())) {
      block[match[1].trim()] = match[2].trim();
    }
  }
  return block;
}

function collectGateBlocks(root) {
  const blocks = [];
  for (const file of walkMarkdownFiles(root)) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes('[DELIVERY GATE]')) {
      blocks.push(text);
    }
  }
  return blocks;
}

function walkMarkdownFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(full);
      }
    }
  }
  return files;
}

function scoreTask(taskType, spec, input) {
  const key = normalize(taskType);
  let score = 0;
  if (input.includes(key.replace(/ /g, ''))) score += 50;
  for (const token of key.split(' ')) {
    if (token && input.includes(token)) score += 8;
  }
  for (const tag of spec.tags || []) {
    const norm = normalize(tag);
    if (input.includes(norm.replace(/ /g, ''))) score += 12;
    if (input.includes(norm)) score += 6;
  }
  for (const routeItem of spec.route || []) {
    const norm = normalize(routeItem);
    if (input.includes(norm.replace(/ /g, ''))) score += 4;
  }
  return score;
}

function firstFallbackKey(profile) {
  for (const key of ['logic', 'ui', 'compat', 'migration', 'regression-risk']) {
    if (profile.routeFallbacks?.[key]) return key;
  }
  return Object.keys(profile.routeFallbacks || {})[0] || '';
}

function humanize(value) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeNewlines(value) {
  return String(value || '').replace(/\r\n/g, '\n').trimEnd();
}

function isFilled(value) {
  return /^(?!\s*$)(?!tbd$)(?!todo$)(?!n\/a$)(?!-$)(?!none$).+/i.test(String(value).trim());
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findRepoRoot(start) {
  let current = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(current, 'agent-system.json'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      text += chunk;
    });
    process.stdin.on('end', () => resolve(text));
  });
}

const requiredGateFields = [
  'Baseline updated',
  'Regression matrix',
  'Old->new mapping',
  'Owned domains closed',
  'Open risks',
  'Blocked / Ready',
];
