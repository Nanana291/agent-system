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
    case 'status':
      await handleStatus(workspace, flags, positional);
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
    case 'memory-search':
      handleMemorySearch(workspace, positional);
      return;
    case 'memory-promote':
      handleMemoryPromote(workspace, positional);
      return;
    case 'memory-prune':
      handleMemoryPrune(workspace);
      return;
    case 'memory-audit':
      handleMemoryAudit(workspace);
      return;
    case 'memory-stats':
      handleMemoryStats(workspace);
      return;
    case 'export':
      handleExport(workspace, flags, positional);
      return;
    case 'import':
      handleImport(workspace, flags, positional);
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
    if (arg === '--interval') {
      flags.interval = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--limit') {
      flags.limit = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--agent') {
      flags.agent = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--name') {
      flags.name = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--action') {
      flags.action = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--state') {
      flags.state = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--scope') {
      flags.scope = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--eta') {
      flags.eta = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--detail') {
      flags.detail = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--once') {
      flags.once = true;
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
    '    search   Search memory files for matching text',
    '    promote  Promote a memory rule between scopes',
    '    prune    Remove duplicate or blank memory entries',
    '    audit    Check memory drift and scope conflicts',
    '    stats    Show memory file counts and entry counts',
    '  status     Read or update live agent presence',
    '    show     Print the current presence snapshot',
    '    set      Update the current presence snapshot',
    '    clear    Mark the current presence as inactive',
    '    list     Print recent presence events',
    '    watch    Render the current snapshot continuously',
    '  export     Export the active profile, memory, and manifest bundle',
    '  import     Import a previously exported bundle',
    '',
    'Flags:',
    '  --profile <name>  Override the active profile',
    '  --agent <id>      Set the status agent id',
    '  --name <text>     Set the human-facing agent name',
    '  --action <text>   Set the current action text',
    '  --state <text>    Set the current state label',
    '  --scope <text>    Set the current scope label',
    '  --eta <text>      Set the current ETA text',
    '  --detail <text>   Set the current detail text',
    '  --interval <sec>  Set status watch interval',
    '  --limit <n>       Limit status list output',
    '  --once            Render status watch once and exit',
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
  const statusDir = path.join(repoRoot, manifest.paths?.status || 'status');
  const statusCurrentPath = path.join(repoRoot, manifest.status?.current || 'status/current.json');
  const statusEventsPath = path.join(repoRoot, manifest.status?.events || 'status/events.jsonl');
  const profile = fs.existsSync(profilePath) ? readJson(profilePath) : null;

  return {
    repoRoot,
    manifest,
    manifestPath,
    activeProfileName,
    profileDir,
    profilePath,
    profileDocPath,
    statusDir,
    statusCurrentPath,
    statusEventsPath,
    profile,
  };
}

function handleValidate(workspace) {
  const issues = [];
  const { repoRoot, manifest, profile, profilePath, profileDocPath, statusCurrentPath, statusEventsPath } = workspace;

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

  if (!fs.existsSync(statusCurrentPath)) {
    issues.push(`missing status snapshot: ${path.relative(repoRoot, statusCurrentPath)}`);
  }
  if (!fs.existsSync(statusEventsPath)) {
    issues.push(`missing status event log: ${path.relative(repoRoot, statusEventsPath)}`);
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
  if (!action) {
    console.error('Usage: agent-system memory <list|add> [target] [text]');
    process.exit(1);
  }

  if (action === 'list') {
    const target = positional[1] || workspace.activeProfileName;
    console.log(listMemoryFiles(workspace.repoRoot, target).join('\n'));
    return;
  }

  if (action === 'add') {
    const target = positional[1] || workspace.activeProfileName;
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

  if (action === 'search') {
    handleMemorySearch(workspace, positional.slice(1));
    return;
  }

  if (action === 'promote') {
    handleMemoryPromote(workspace, positional.slice(1));
    return;
  }

  if (action === 'prune') {
    handleMemoryPrune(workspace);
    return;
  }

  if (action === 'audit') {
    handleMemoryAudit(workspace);
    return;
  }

  if (action === 'stats') {
    handleMemoryStats(workspace);
    return;
  }

  console.error(`Unknown memory action: ${action}`);
  process.exit(1);
}

function handleMemorySearch(workspace, positional) {
  const query = positional.join(' ').trim();
  if (!query) {
    console.error('Usage: agent-system memory search <text>');
    process.exit(1);
  }
  const hits = searchMemoryFiles(workspace.repoRoot, query);
  console.log(`Hits: ${hits.length}`);
  for (const hit of hits) {
    console.log(`- ${hit.file}: ${hit.line}`);
  }
}

function handleMemoryPromote(workspace, positional) {
  const fromScope = positional[0];
  const toScope = positional[1];
  const query = positional.slice(2).join(' ').trim();
  if (!fromScope || !toScope || !query) {
    console.error('Usage: agent-system memory promote <fromScope> <toScope> <text>');
    process.exit(1);
  }
  const fromFile = resolveMemoryTarget(workspace.repoRoot, fromScope, workspace.activeProfileName);
  const toFile = resolveMemoryTarget(workspace.repoRoot, toScope, workspace.activeProfileName);
  const text = findMemoryEntry(fromFile, query);
  if (!text) {
    console.error(`No entry matched in ${fromScope}: ${query}`);
    process.exit(1);
  }
  appendMemoryEntry(toFile, text);
  console.log(`Promoted rule from ${fromScope} to ${toScope}`);
}

function handleMemoryPrune(workspace) {
  const report = pruneMemory(workspace.repoRoot);
  console.log(`Pruned: ${report.pruned}`);
  for (const note of report.notes) {
    console.log(`- ${note}`);
  }
}

function handleMemoryAudit(workspace) {
  const report = auditMemory(workspace.repoRoot, workspace.manifest, workspace.profile);
  console.log(`Audit: ${report.ok ? 'OK' : 'FAILED'}`);
  for (const issue of report.issues) {
    console.log(`- ${issue}`);
  }
  process.exit(report.ok ? 0 : 1);
}

function handleMemoryStats(workspace) {
  const stats = memoryStats(workspace.repoRoot);
  console.log(`Files: ${stats.files}`);
  console.log(`Entries: ${stats.entries}`);
  console.log(`Scopes: system=${stats.system}, profile=${stats.profile}, host=${stats.host}`);
}

async function handleStatus(workspace, flags, positional) {
  const action = positional[0] || 'show';
  switch (action) {
    case 'show':
      console.log(renderStatusLine(readStatusCurrent(workspace)));
      return;
    case 'set': {
      const snapshot = buildStatusSnapshot(workspace, flags, readStatusCurrent(workspace));
      writeStatusRecord(workspace, snapshot, 'set');
      console.log(renderStatusLine(snapshot));
      return;
    }
    case 'clear': {
      const snapshot = createIdleStatusSnapshot();
      snapshot.updatedAt = new Date().toISOString();
      writeStatusRecord(workspace, snapshot, 'clear');
      console.log(renderStatusLine(snapshot));
      return;
    }
    case 'list': {
      const events = readStatusEvents(workspace);
      const limit = parseCount(flags.limit, 10);
      const slice = (limit > 0 ? events.slice(-limit) : events).reverse();
      if (slice.length === 0) {
        console.log('No status events recorded.');
        return;
      }
      for (const event of slice) {
        console.log(renderStatusLine(event, event.recordedAt || event.updatedAt || new Date().toISOString(), true));
      }
      return;
    }
    case 'watch':
      await watchStatus(workspace, flags);
      return;
    default:
      console.error(`Unknown status action: ${action}`);
      process.exit(1);
  }
}

function handleExport(workspace, flags, positional) {
  const profileName = flags.profile || workspace.activeProfileName;
  const bundle = buildExportBundle(workspace, profileName);
  const outputPath = positional[0] || path.join(workspace.repoRoot, `${profileName}-export.json`);
  fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
  console.log(`Exported ${profileName} to ${outputPath}`);
}

function handleImport(workspace, flags, positional) {
  const inputPath = flags.files?.[0] || positional[0];
  if (!inputPath) {
    console.error('Usage: agent-system import --file <bundle.json>');
    process.exit(1);
  }
  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.resolve(workspace.repoRoot, inputPath);
  const bundle = readJson(absolutePath);
  const imported = importBundle(workspace.repoRoot, bundle);
  console.log(`Imported ${imported.profileName}`);
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
    ['status schema exists', () => fs.existsSync(path.join(workspace.repoRoot, workspace.manifest.status?.schema || 'docs/status-schema.md'))],
    ['status snapshot exists', () => fs.existsSync(workspace.statusCurrentPath)],
    ['status event log exists', () => fs.existsSync(workspace.statusEventsPath)],
    ['command script exists', () => fs.existsSync(path.join(workspace.repoRoot, 'bin', 'agent-system.mjs'))],
    ['memory audit clean', () => auditMemory(workspace.repoRoot, workspace.manifest, workspace.profile).ok],
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

function buildExportBundle(workspace, profileName) {
  const profilePath = path.join(workspace.repoRoot, 'profiles', profileName, 'profile.json');
  const profileDocPath = path.join(workspace.repoRoot, 'profiles', profileName, 'AGENTS.md');
  const profile = readJson(profilePath);
  const bundle = {
    exportedAt: new Date().toISOString(),
    manifest: workspace.manifest,
    profile,
    profileDoc: fs.readFileSync(profileDocPath, 'utf8'),
    memory: {
      system: readOptionalText(path.join(workspace.repoRoot, workspace.manifest.memory?.system || 'memory/system.md')),
      profile: readOptionalText(path.join(workspace.repoRoot, profile.memory?.profileMemory || `memory/profile/${profileName}.md`)),
      host: {
        generic: readOptionalText(path.join(workspace.repoRoot, workspace.manifest.memory?.host?.generic || 'memory/host/generic.md')),
        claude: readOptionalText(path.join(workspace.repoRoot, workspace.manifest.memory?.host?.claude || 'memory/host/claude.md')),
        codex: readOptionalText(path.join(workspace.repoRoot, workspace.manifest.memory?.host?.codex || 'memory/host/codex.md')),
        qwen: readOptionalText(path.join(workspace.repoRoot, workspace.manifest.memory?.host?.qwen || 'memory/host/qwen.md')),
      },
    },
    status: {
      current: readOptionalText(workspace.statusCurrentPath),
      events: readOptionalText(workspace.statusEventsPath),
    },
    memoryIndex: memoryStats(workspace.repoRoot),
  };
  return bundle;
}

function importBundle(repoRoot, bundle) {
  const profileName = bundle?.profile?.profile || bundle?.profile?.name || 'imported-profile';
  const targetProfileDir = path.join(repoRoot, 'profiles', profileName);
  fs.mkdirSync(targetProfileDir, { recursive: true });
  fs.writeFileSync(path.join(targetProfileDir, 'profile.json'), JSON.stringify(bundle.profile, null, 2) + '\n', 'utf8');
  if (bundle.profileDoc) {
    fs.writeFileSync(path.join(targetProfileDir, 'AGENTS.md'), bundle.profileDoc, 'utf8');
  }
  if (bundle.memory?.profile) {
    const profileMemoryPath = path.join(repoRoot, bundle.profile?.memory?.profileMemory || `memory/profile/${profileName}.md`);
    fs.mkdirSync(path.dirname(profileMemoryPath), { recursive: true });
    fs.writeFileSync(profileMemoryPath, bundle.memory.profile, 'utf8');
  }
  if (bundle.memory?.system) {
    writeOptionalText(path.join(repoRoot, bundle.manifest?.memory?.system || 'memory/system.md'), bundle.memory.system);
  }
  for (const [host, text] of Object.entries(bundle.memory?.host || {})) {
    if (text) {
      const hostPath = path.join(repoRoot, bundle.manifest?.memory?.host?.[host] || `memory/host/${host}.md`);
      writeOptionalText(hostPath, text);
    }
  }
  if (bundle.status?.current) {
    writeOptionalText(path.join(repoRoot, bundle.manifest?.status?.current || 'status/current.json'), bundle.status.current);
  }
  if (bundle.status?.events) {
    writeOptionalText(path.join(repoRoot, bundle.manifest?.status?.events || 'status/events.jsonl'), bundle.status.events);
  }
  return { profileName };
}

function searchMemoryFiles(repoRoot, query) {
  const hits = [];
  for (const file of walkFiles(path.join(repoRoot, 'memory'))) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(query.toLowerCase())) {
        hits.push({ file: path.relative(repoRoot, file), line: `${index + 1}: ${line.trim()}` });
      }
    });
  }
  return hits;
}

function findMemoryEntry(filePath, query) {
  if (!fs.existsSync(filePath)) return '';
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  return lines.find((line) => line.toLowerCase().includes(query.toLowerCase()) && line.trim().startsWith('- ')) || '';
}

function pruneMemory(repoRoot) {
  const notes = [];
  let pruned = 0;
  for (const file of walkFiles(path.join(repoRoot, 'memory'))) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    const seen = new Set();
    const kept = [];
    for (const line of lines) {
      const normalized = line.trim();
      if (!normalized) {
        kept.push(line);
        continue;
      }
      if (normalized.startsWith('- ')) {
        const key = normalized.toLowerCase();
        if (seen.has(key)) {
          pruned += 1;
          continue;
        }
        seen.add(key);
      }
      kept.push(line);
    }
    const next = kept.join('\n').replace(/\n{3,}/g, '\n\n');
    if (next !== text) {
      fs.writeFileSync(file, next.trimEnd() + '\n', 'utf8');
      notes.push(`updated ${path.relative(repoRoot, file)}`);
    }
  }
  return { pruned, notes };
}

function auditMemory(repoRoot, manifest, profile) {
  const issues = [];
  const profileName = profile?.profile || 'imphub';
  const system = readOptionalText(path.join(repoRoot, manifest.memory?.system || 'memory/system.md'));
  const profileText = readOptionalText(path.join(repoRoot, profile?.memory?.profileMemory || `memory/profile/${profileName}.md`));
  const hostGeneric = readOptionalText(path.join(repoRoot, manifest.memory?.host?.generic || 'memory/host/generic.md'));

  if (!system.includes('Superpowers decides process')) issues.push('system memory missing core authority rule');
  if (!system.includes('Structured manifests are authoritative')) issues.push('system memory missing manifest authority rule');
  if (!profileText.includes('Durable lessons and preferences')) issues.push('profile memory missing durable lessons note');
  if (!profileText.includes('Do not silently move ownership')) issues.push('profile memory missing ownership guard');
  if (!hostGeneric.includes('fallback host memory file')) issues.push('generic host memory missing fallback note');
  if (profile?.memory?.durabilityRule && !profileText.includes('When a mistake has a clear fix')) {
    issues.push('profile memory durability rule not reflected in profile memory file');
  }

  const manifestScopes = [
    manifest.memory?.system,
    manifest.memory?.host?.generic,
    manifest.memory?.host?.claude,
    manifest.memory?.host?.codex,
    manifest.memory?.host?.qwen,
    profile?.memory?.profileMemory,
  ].filter(Boolean);
  if (new Set(manifestScopes).size !== manifestScopes.length) {
    issues.push('memory manifest contains duplicate paths');
  }

  return { ok: issues.length === 0, issues };
}

function memoryStats(repoRoot) {
  const files = walkFiles(path.join(repoRoot, 'memory')).filter((file) => file.endsWith('.md'));
  let entries = 0;
  let system = 0;
  let profile = 0;
  let host = 0;
  for (const file of files) {
    const relative = path.relative(repoRoot, file);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    entries += lines.filter((line) => line.trim().startsWith('- ')).length;
    if (relative.startsWith(`memory${path.sep}system`)) system += 1;
    else if (relative.startsWith(`memory${path.sep}profile${path.sep}`)) profile += 1;
    else if (relative.startsWith(`memory${path.sep}host${path.sep}`)) host += 1;
  }
  return { files: files.length, entries, system, profile, host };
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

function readStatusCurrent(workspace) {
  const filePath = workspace.statusCurrentPath;
  if (!fs.existsSync(filePath)) {
    return createIdleStatusSnapshot();
  }
  try {
    return { ...createIdleStatusSnapshot(), ...readJson(filePath) };
  } catch {
    return createIdleStatusSnapshot();
  }
}

function readStatusEvents(workspace) {
  const filePath = workspace.statusEventsPath;
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const events = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      continue;
    }
  }
  return events;
}

function writeStatusRecord(workspace, snapshot, eventType) {
  const currentPath = workspace.statusCurrentPath;
  const eventsPath = workspace.statusEventsPath;
  const now = new Date().toISOString();
  const current = {
    ...createIdleStatusSnapshot(),
    ...snapshot,
    updatedAt: now,
  };
  fs.mkdirSync(path.dirname(currentPath), { recursive: true });
  fs.writeFileSync(currentPath, JSON.stringify(current, null, 2) + '\n', 'utf8');

  const events = readStatusEvents(workspace);
  const record = {
    ...current,
    eventType,
    sequence: events.length + 1,
    recordedAt: now,
  };
  fs.mkdirSync(path.dirname(eventsPath), { recursive: true });
  fs.appendFileSync(eventsPath, JSON.stringify(record) + '\n', 'utf8');
  return current;
}

function buildStatusSnapshot(workspace, flags, current) {
  const now = new Date().toISOString();
  const currentSnapshot = current || createIdleStatusSnapshot();
  const hasIntent = Boolean(flags.agent || flags.name || flags.action || flags.state || flags.scope || flags.eta || flags.detail);
  const agent = flags.agent || (currentSnapshot.active ? currentSnapshot.agent : null) || normalizeAgentName(flags.name || currentSnapshot.name || currentSnapshot.scope || 'agent');
  const name = flags.name || (flags.agent ? humanizeAgentName(flags.agent) : currentSnapshot.active ? currentSnapshot.name : humanizeAgentName(agent));
  const scope = flags.scope || (currentSnapshot.active && currentSnapshot.agent === agent ? currentSnapshot.scope : inferScopeFromAgent(agent));
  const state = flags.state || (hasIntent ? 'working' : currentSnapshot.state || 'idle');
  const action = flags.action || (hasIntent ? 'Working' : currentSnapshot.action || 'No active agent');
  const active = !['idle', 'inactive', 'done'].includes(String(state).toLowerCase());
  const startedAt = currentSnapshot.active && currentSnapshot.agent === agent && currentSnapshot.scope === scope && currentSnapshot.startedAt
    ? currentSnapshot.startedAt
    : now;

  return {
    agent,
    name,
    action,
    state,
    scope,
    startedAt,
    updatedAt: now,
    eta: flags.eta || currentSnapshot.eta || null,
    detail: flags.detail || currentSnapshot.detail || '',
    active,
  };
}

function createIdleStatusSnapshot() {
  return {
    agent: null,
    name: 'Idle',
    action: 'No active agent',
    state: 'idle',
    scope: 'none',
    startedAt: null,
    updatedAt: null,
    eta: null,
    detail: '',
    active: false,
  };
}

function renderStatusLine(status, referenceTime = status.updatedAt || status.startedAt || new Date().toISOString(), compact = false) {
  const elapsed = formatElapsed(status.startedAt, referenceTime);
  const parts = [
    `[AGENT] ${status.name || 'Idle'}`,
    status.action || 'No active agent',
    elapsed,
  ];
  if (status.scope && status.scope !== 'none') {
    parts.push(`scope=${status.scope}`);
  }
  if (status.eta) {
    parts.push(`eta=${status.eta}`);
  }
  if (status.state && (!compact || status.state !== 'working')) {
    parts.push(`state=${status.state}`);
  }
  if (status.detail) {
    parts.push(`detail=${status.detail}`);
  }
  return parts.join(' | ');
}

function formatElapsed(startedAt, referenceTime) {
  if (!startedAt) {
    return '00:00 elapsed';
  }
  const start = new Date(startedAt).getTime();
  const end = new Date(referenceTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return '00:00 elapsed';
  }
  const totalSeconds = Math.floor((end - start) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${padNumber(hours)}:${padNumber(minutes)}:${padNumber(seconds)} elapsed`;
  }
  return `${padNumber(minutes)}:${padNumber(seconds)} elapsed`;
}

function parseCount(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeAgentName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase() || null;
}

function humanizeAgentName(value) {
  const text = String(value || '').trim();
  if (!text) {
    return 'Idle';
  }
  return text
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function inferScopeFromAgent(agent) {
  const normalized = String(agent || '').trim().toLowerCase();
  if (!normalized) {
    return 'general';
  }
  if (normalized.includes('ghost')) {
    return 'farm-loop';
  }
  if (normalized.includes('sentinel')) {
    return 'watch';
  }
  return 'general';
}

async function watchStatus(workspace, flags) {
  const intervalMs = Math.max(1, parseCount(flags.interval, 2)) * 1000;
  const once = !!flags.once;
  let lastLine = '';

  while (true) {
    const snapshot = readStatusCurrent(workspace);
    const line = renderStatusLine(snapshot);
    if (process.stdout.isTTY) {
      const padded = line + ' '.repeat(Math.max(0, lastLine.length - line.length));
      process.stdout.write(`\r${padded}`);
      if (once) {
        process.stdout.write('\n');
      }
    } else if (once || line !== lastLine) {
      console.log(line);
    }
    if (once) {
      return;
    }
    lastLine = line;
    await sleep(intervalMs);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function padNumber(value) {
  return String(value).padStart(2, '0');
}

function readOptionalText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function writeOptionalText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, 'utf8');
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
