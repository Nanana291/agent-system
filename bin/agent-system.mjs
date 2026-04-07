#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
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

  const workspace = loadWorkspace(flags.profile, flags.host);

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
    case 'change':
      await handleChange(workspace, flags, positional);
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
    case 'memory-learn':
      handleMemoryLearn(workspace, flags);
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
    if (arg === '--host') {
      flags.host = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--interval') {
      flags.interval = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--threshold') {
      flags.threshold = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--limit') {
      flags.limit = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--apply') {
      flags.apply = true;
      continue;
    }
    if (arg === '--dry-run') {
      flags.dryRun = true;
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
    if (arg === '--type') {
      flags.type = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--target') {
      flags.target = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--intent') {
      flags.intent = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--baseline') {
      flags.baseline = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--classification') {
      flags.classification = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--owned-domains') {
      flags.ownedDomains = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--regression-matrix') {
      flags.regressionMatrix = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--old-new') {
      flags.oldNew = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--task') {
      flags.task = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--route') {
      flags.route = argv[i + 1];
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
    '  change     Analyze, scaffold, preview, apply, and gate a change workflow',
    '    scout    Detect likely change targets from git status',
    '    auto-scaffold  Scaffold the current change from inferred changes',
    '    analyze  Produce a structured task lock for a change intent',
    '    scaffold Create the intake and scaffold files for a change',
    '    preview  Show the intake and gate status without writing',
    '    apply    Write the intake and scaffold files for a change',
    '    diff     Compare the current intake against the last gate',
    '    rollback Restore the last committed change intake snapshot',
    '    gate     Validate the current change intake and delivery gate',
    '  memory    Read or update layered memory files',
    '    search   Search memory files for matching text',
    '    promote  Promote a memory rule between scopes',
    '    prune    Remove duplicate or blank memory entries',
    '    audit    Check memory drift and scope conflicts',
    '    stats    Show memory file counts and entry counts',
    '    capture  Capture a change memory note automatically',
    '    review   Review host memory quality and repetition',
    '    compress Compress repeated host lessons into stable rules',
    '    teach    Promote durable host lessons into memory',
    '    gate     Validate host-local memory readiness',
    '    reflect  Capture a host reflection note',
    '    packs    Generate or list host learning packs',
    '    suggest  Propose memory promotions from change lessons',
    '    learn    Auto-promote repeated lessons into higher memory scopes',
    '  status     Read or update live agent presence',
    '    show     Print the current presence snapshot',
    '    who      Print the active session summary',
    '    set      Update the current presence snapshot',
    '    heartbeat Refresh the current snapshot timestamp',
    '    attach   Bind the snapshot to a task and route',
    '    clear    Mark the current presence as inactive',
    '    list     Print recent presence events',
    '    watch    Render the current snapshot continuously',
    '  export     Export the active profile, memory, and manifest bundle',
    '  import     Import a previously exported bundle',
    '',
    'Flags:',
    '  --profile <name>  Override the active profile',
    '  --host <name>     Override the active host (claude|codex|qwen)',
    '  --agent <id>      Set the status agent id',
    '  --name <text>     Set the human-facing agent name',
    '  --action <text>   Set the current action text',
    '  --type <text>     Set the change type',
    '  --target <path>   Set the change target',
    '  --intent <text>   Set the change intent',
    '  --baseline <path> Set the baseline file',
    '  --classification <list>  Set comma-separated change classifications',
    '  --owned-domains <list>    Set comma-separated owned domains',
    '  --regression-matrix <path> Set the regression matrix template',
    '  --old-new <text>  Set the old->new mapping summary',
    '  --task <text>     Set the attached task label',
    '  --route <text>    Set the attached route label',
    '  --state <text>    Set the current state label',
    '  --scope <text>    Set the current scope label',
    '  --eta <text>      Set the current ETA text',
    '  --detail <text>   Set the current detail text',
    '  --interval <sec>  Set status watch interval',
    '  --threshold <n>   Set memory learn promotion threshold',
    '  --limit <n>       Limit status list output',
    '  --apply           Apply memory learn promotions',
    '  --dry-run         Preview memory learn promotions without writing',
    '  --once            Render status watch once and exit',
    '  --file <path>     Read gate markdown from explicit file(s)',
    '  --write           Write regenerated profile markdown during sync',
    '  --help            Show this message',
  ].join('\n'));
}

function loadWorkspace(profileName, hostName) {
  const repoRoot = findRepoRoot(process.cwd()) || findRepoRoot(scriptDir);
  const manifestPath = path.join(repoRoot, 'agent-system.json');
  const manifest = readJson(manifestPath);
  const activeProfileName = profileName || manifest.profileDiscovery?.defaultProfile;
  const activeHostName = normalizeHostName(hostName || process.env.AGENT_SYSTEM_HOST || 'qwen');
  const profileDir = path.join(repoRoot, 'profiles', activeProfileName);
  const profilePath = path.join(profileDir, 'profile.json');
  const profileDocPath = path.join(profileDir, 'AGENTS.md');
  const statusDir = path.join(repoRoot, manifest.paths?.status || 'status');
  const statusCurrentPath = path.join(repoRoot, manifest.status?.current || 'status/current.json');
  const statusEventsPath = path.join(repoRoot, manifest.status?.events || 'status/events.jsonl');
  const changeDir = path.join(repoRoot, manifest.paths?.change || 'change');
  const changeCurrentPath = path.join(repoRoot, manifest.change?.current || 'change/current.json');
  const changeHistoryPath = path.join(repoRoot, manifest.change?.history || 'change/history.jsonl');
  const changeReadmePath = path.join(repoRoot, manifest.change?.readme || 'change/README.md');
  const changeSchemaPath = path.join(repoRoot, manifest.change?.schema || 'docs/change-schema.md');
  const changeTemplatePath = path.join(repoRoot, manifest.change?.intakeTemplate || 'templates/change-intake.md');
  const changeMemoryPath = resolveHostMemoryPath(repoRoot, activeHostName, 'change');
  const hostMemoryPath = resolveHostMemoryPath(repoRoot, activeHostName, 'host');
  const packMemoryPath = resolveHostMemoryPath(repoRoot, activeHostName, 'packs');
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
    changeDir,
    changeCurrentPath,
    changeHistoryPath,
    changeReadmePath,
    changeSchemaPath,
    changeTemplatePath,
    changeMemoryPath,
    hostMemoryPath,
    packMemoryPath,
    activeHostName,
    profile,
  };
}

function normalizeHostName(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text.includes('qwen')) return 'qwen';
  if (text.includes('claude')) return 'claude';
  if (text.includes('codex')) return 'codex';
  return 'qwen';
}

function resolveHostMemoryPath(repoRoot, hostName, scope) {
  const normalizedHost = normalizeHostName(hostName);
  if (scope === 'host') {
    return path.join(repoRoot, 'memory', 'host', `${normalizedHost}.md`);
  }
  if (scope === 'change') {
    return path.join(repoRoot, 'memory', 'change', `${normalizedHost}.md`);
  }
  if (scope === 'packs') {
    return path.join(repoRoot, 'memory', 'packs', `${normalizedHost}.md`);
  }
  return path.join(repoRoot, 'memory', 'host', `${normalizedHost}.md`);
}

function hasAnyChangeMemoryFile(repoRoot) {
  const dir = path.join(repoRoot, 'memory', 'change');
  if (!fs.existsSync(dir)) {
    return false;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.some((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name.toLowerCase() !== 'readme.md');
}

function resolveTemplatePath(repoRoot, template, profileName, fallback = '') {
  const relative = String(template || fallback || '').trim().replace(/<profile>/g, profileName || 'profile');
  if (!relative) {
    return '';
  }
  return path.join(repoRoot, relative);
}

function handleValidate(workspace) {
  const issues = [];
  const { repoRoot, manifest, profile, profilePath, profileDocPath, statusCurrentPath, statusEventsPath, changeCurrentPath, changeHistoryPath, changeReadmePath, changeSchemaPath, changeTemplatePath, changeMemoryPath } = workspace;

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

  for (const file of Object.values(manifest.memory?.host || {})) {
    if (!fs.existsSync(path.join(repoRoot, file))) {
      issues.push(`missing host memory file: ${file}`);
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
  if (!fs.existsSync(changeCurrentPath)) {
    issues.push(`missing change intake snapshot: ${path.relative(repoRoot, changeCurrentPath)}`);
  }
  if (!fs.existsSync(changeHistoryPath)) {
    issues.push(`missing change history log: ${path.relative(repoRoot, changeHistoryPath)}`);
  }
  if (!fs.existsSync(changeReadmePath)) {
    issues.push(`missing change readme: ${path.relative(repoRoot, changeReadmePath)}`);
  }
  if (!fs.existsSync(changeSchemaPath)) {
    issues.push(`missing change schema: ${path.relative(repoRoot, changeSchemaPath)}`);
  }
  if (!fs.existsSync(changeTemplatePath)) {
    issues.push(`missing change template: ${path.relative(repoRoot, changeTemplatePath)}`);
  }
  if (!fs.existsSync(changeMemoryPath) && !hasAnyChangeMemoryFile(repoRoot)) {
    issues.push(`missing change memory: ${path.relative(repoRoot, changeMemoryPath)}`);
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
  ensureMemoryChangeFile(workspace.repoRoot, profileName);
  console.log(`Initialized profile: ${profileName}`);
}

function handleMemory(workspace, flags, positional) {
  const action = positional[0];
  if (!action) {
    console.error('Usage: agent-system memory <list|add|search|promote|prune|audit|stats|capture|review|compress|teach|gate|reflect|packs|learn> ...');
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

  if (action === 'capture') {
    handleMemoryCapture(workspace, positional.slice(1));
    return;
  }

  if (action === 'review') {
    handleMemoryReview(workspace, flags);
    return;
  }

  if (action === 'compress') {
    handleMemoryCompress(workspace, flags);
    return;
  }

  if (action === 'teach') {
    handleMemoryTeach(workspace, flags);
    return;
  }

  if (action === 'gate') {
    handleMemoryGate(workspace, flags);
    return;
  }

  if (action === 'reflect') {
    handleMemoryReflect(workspace, flags);
    return;
  }

  if (action === 'packs') {
    handleLearningPacks(workspace, flags, positional.slice(1));
    return;
  }

  if (action === 'learn') {
    handleMemoryLearn(workspace, flags);
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
  const report = auditMemory(workspace.repoRoot, workspace.manifest, workspace.profile, workspace.activeHostName);
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
  console.log(`Scopes: host=${stats.host}, change=${stats.change}, packs=${stats.packs}`);
}

function handleMemoryReview(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const report = reviewHostMemory(workspace.repoRoot, hostName);
  console.log('[MEMORY REVIEW]');
  console.log(`Host: ${hostName}`);
  console.log(`Weak notes: ${report.weak}`);
  console.log('Duplicate lessons:');
  for (const line of report.duplicates) {
    console.log(`- ${line}`);
  }
  console.log('Compression candidates:');
  for (const line of report.candidates) {
    console.log(`- ${line}`);
  }
}

function handleMemoryCompress(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const report = compressHostMemory(workspace.repoRoot, hostName);
  console.log('[MEMORY COMPRESS]');
  console.log(`Host: ${hostName}`);
  console.log(`Wrote: ${path.relative(workspace.repoRoot, report.targetPath)}`);
  console.log(`Compressed: ${report.compressed}`);
}

function handleMemoryTeach(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const report = teachHostMemory(workspace.repoRoot, hostName);
  console.log('[MEMORY TEACH]');
  console.log(`Host: ${hostName}`);
  console.log(`Wrote: ${path.relative(workspace.repoRoot, report.targetPath)}`);
}

function handleMemoryGate(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const report = gateHostMemory(workspace.repoRoot, hostName);
  console.log('[MEMORY GATE]');
  console.log(`Host: ${hostName}`);
  console.log(`Ready: ${report.ready ? 'yes' : 'no'}`);
  console.log(`Reason: ${report.reason}`);
}

function handleMemoryReflect(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const intake = readChangeCurrent(workspace);
  const report = evaluateChangeGate(intake);
  const reflection = recordHostReflection(workspace, intake, report, hostName);
  console.log('[MEMORY REFLECT]');
  console.log(`Host: ${hostName}`);
  console.log(`Wrote: ${path.relative(workspace.repoRoot, reflection.targetPath)}`);
}

function handleLearningPacks(workspace, flags, positional) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const action = positional[0] || 'list';
  const report = action === 'generate'
    ? generateLearningPack(workspace.repoRoot, hostName)
    : listLearningPack(workspace.repoRoot, hostName);
  console.log('[LEARNING PACKS]');
  console.log(`Host: ${hostName}`);
  console.log(`Pack: ${path.relative(workspace.repoRoot, report.targetPath)}`);
  if (action === 'generate') {
    console.log('Generated: yes');
  }
}

function handleMemoryLearn(workspace, flags) {
  const threshold = parseCount(flags.threshold, 2);
  const apply = flags.dryRun ? false : flags.apply !== false;
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const report = learnMemory(workspace.repoRoot, hostName, threshold, apply);
  console.log('[MEMORY LEARN]');
  console.log(`Host: ${hostName}`);
  console.log(`Threshold: ${report.threshold}`);
  console.log(`Apply: ${report.applied ? 'yes' : 'no'}`);
  console.log(`Promoted: ${report.promoted}`);
  if (report.duplicates.length > 0) {
    console.log('Duplicate lessons:');
    for (const line of report.duplicates) {
      console.log(`- ${line}`);
    }
  }
  if (report.promotions.length > 0) {
    console.log('Promotions:');
    for (const promotion of report.promotions) {
      console.log(`- ${promotion.target}: ${promotion.text}`);
    }
  }
}

function handleMemoryCapture(workspace, positional) {
  const source = positional[0] || 'change';
  if (source !== 'change') {
    console.error('Usage: agent-system memory capture change');
    process.exit(1);
  }
  const intake = readChangeCurrent(workspace);
  const report = evaluateChangeGate(intake);
  captureChangeMemory(workspace, intake, report, workspace.activeHostName);
  console.log(`Captured change memory for ${intake.target || 'unknown target'}`);
}

function reviewHostMemory(repoRoot, hostName) {
  const normalizedHost = normalizeHostName(hostName);
  const changePath = resolveHostMemoryPath(repoRoot, normalizedHost, 'change');
  const hostPath = resolveHostMemoryPath(repoRoot, normalizedHost, 'host');
  const changeEntries = readMemoryBullets(changePath);
  const hostEntries = readMemoryBullets(hostPath);
  const hostSet = new Set(hostEntries.map((entry) => normalizeMemoryBullet(entry)));
  const counts = new Map();
  const duplicates = [];
  const candidates = [];
  let weak = 0;

  for (const entry of changeEntries) {
    const key = normalizeMemoryBullet(entry);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  for (const [key, count] of counts.entries()) {
    const entry = changeEntries.find((line) => normalizeMemoryBullet(line) === key) || '';
    const text = stripBulletPrefix(entry);
    if (!text) {
      weak += 1;
      continue;
    }
    if (count > 1) {
      duplicates.push(text);
    }
    if (count > 1 || !hostSet.has(key) || isUniversalMemoryRule(text)) {
      candidates.push(text);
    }
    if (text.length < 20 || /maybe|todo|temp|unclear/i.test(text)) {
      weak += 1;
    }
  }

  return { weak, duplicates, candidates };
}

function compressHostMemory(repoRoot, hostName) {
  const normalizedHost = normalizeHostName(hostName);
  const changePath = resolveHostMemoryPath(repoRoot, normalizedHost, 'change');
  const review = reviewHostMemory(repoRoot, normalizedHost);
  const lessons = [];
  const seen = new Set();

  for (const line of review.candidates) {
    const text = stripBulletPrefix(line);
    const key = normalizeMemoryBullet(text);
    if (!text || seen.has(key)) {
      continue;
    }
    seen.add(key);
    lessons.push(text);
  }

  fs.mkdirSync(path.dirname(changePath), { recursive: true });
  const lines = [
    `# ${humanize(normalizedHost)} Change Memory`,
    '',
    'Change-specific lessons captured from gates and reflections live here.',
    '',
    ...(lessons.length > 0 ? lessons.map((lesson) => `- ${lesson}`) : ['- No durable lessons recorded yet.']),
    '',
  ];
  fs.writeFileSync(changePath, lines.join('\n'), 'utf8');
  return { targetPath: changePath, compressed: lessons.length };
}

function teachHostMemory(repoRoot, hostName) {
  const normalizedHost = normalizeHostName(hostName);
  const hostPath = resolveHostMemoryPath(repoRoot, normalizedHost, 'host');
  const review = reviewHostMemory(repoRoot, normalizedHost);
  const current = readOptionalText(hostPath);
  const lines = current.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const known = new Set(lines.map((line) => normalizeMemoryBullet(line)));

  for (const line of review.candidates) {
    const text = stripBulletPrefix(line);
    const key = normalizeMemoryBullet(text);
    if (!text || known.has(key)) {
      continue;
    }
    lines.push(`- ${text}`);
    known.add(key);
  }

  if (lines.length === 0) {
    lines.push(`# ${humanize(normalizedHost)} Memory`);
    lines.push('');
    lines.push('- No durable lessons yet.');
  }

  fs.mkdirSync(path.dirname(hostPath), { recursive: true });
  fs.writeFileSync(hostPath, `${lines.join('\n').trimEnd()}\n`, 'utf8');
  return { targetPath: hostPath };
}

function gateHostMemory(repoRoot, hostName) {
  const normalizedHost = normalizeHostName(hostName);
  const review = reviewHostMemory(repoRoot, normalizedHost);
  const ready = review.candidates.length > 0 && review.weak === 0;
  return {
    ready,
    reason: ready ? 'host memory is compact and reusable' : 'host memory still has weak or uncompressed notes',
  };
}

function recordHostReflection(workspace, intake, report, hostName) {
  const normalizedHost = normalizeHostName(hostName || workspace.activeHostName);
  const changePath = resolveHostMemoryPath(workspace.repoRoot, normalizedHost, 'change');
  ensureMemoryChangeFile(workspace.repoRoot, normalizedHost);
  const target = intake?.target || 'unknown target';
  const type = intake?.type || 'unknown';
  const status = report?.ready ? 'ready' : 'blocked';
  const line = `Reflection for ${type} change targeting ${target}; status: ${status}; host: ${normalizedHost}.`;
  appendMemoryEntry(changePath, line);
  return { targetPath: changePath };
}

function generateLearningPack(repoRoot, hostName) {
  const normalizedHost = normalizeHostName(hostName);
  const hostPath = resolveHostMemoryPath(repoRoot, normalizedHost, 'host');
  const packPath = resolveHostMemoryPath(repoRoot, normalizedHost, 'packs');
  const hostEntries = readMemoryBullets(hostPath);
  const lines = [
    `# ${humanize(normalizedHost)} Learning Pack`,
    '',
    `Host memory: ${path.relative(repoRoot, hostPath)}`,
    '',
    '## Durable Lessons',
    '',
    ...(hostEntries.length > 0 ? hostEntries : ['- No durable lessons yet.']),
    '',
  ];
  fs.mkdirSync(path.dirname(packPath), { recursive: true });
  fs.writeFileSync(packPath, lines.join('\n'), 'utf8');
  return { targetPath: packPath };
}

function listLearningPack(repoRoot, hostName) {
  const normalizedHost = normalizeHostName(hostName);
  const packPath = resolveHostMemoryPath(repoRoot, normalizedHost, 'packs');
  return { targetPath: packPath };
}

async function handleChange(workspace, flags, positional) {
  const action = positional[0] || 'analyze';
  switch (action) {
    case 'scout': {
      const intake = buildChangeIntake(workspace, flags, readChangeCurrent(workspace), true);
      console.log(renderChangeTaskLock(intake));
      return;
    }
    case 'analyze': {
      const intake = buildChangeIntake(workspace, flags, readChangeCurrent(workspace));
      writeChangeRecord(workspace, intake, 'analyze');
      console.log(renderChangeTaskLock(intake));
      return;
    }
    case 'auto-scaffold':
    case 'scaffold': {
      const intake = buildChangeIntake(workspace, flags, readChangeCurrent(workspace), true);
      const scaffoldedIntake = {
        ...intake,
        scaffoldedAt: intake.scaffoldedAt || new Date().toISOString(),
      };
      scaffoldChangeWorkspace(workspace, scaffoldedIntake);
      writeChangeRecord(workspace, scaffoldedIntake, 'scaffold');
      console.log(`Initialized change workspace: ${path.relative(workspace.repoRoot, workspace.changeDir)}`);
      console.log(renderChangeTaskLock(scaffoldedIntake));
      return;
    }
    case 'preview': {
      const intake = buildChangeIntake(workspace, flags, readChangeCurrent(workspace), true);
      const report = evaluateChangeGate(intake);
      console.log(renderChangePreview(intake, report));
      process.exit(report.ready ? 0 : 1);
      return;
    }
    case 'apply': {
      const intake = buildChangeIntake(workspace, flags, readChangeCurrent(workspace), true);
      const appliedIntake = {
        ...intake,
        scaffoldedAt: intake.scaffoldedAt || new Date().toISOString(),
      };
      scaffoldChangeWorkspace(workspace, appliedIntake);
      writeChangeRecord(workspace, appliedIntake, 'apply');
      console.log(`Applied change workspace: ${path.relative(workspace.repoRoot, workspace.changeDir)}`);
      console.log(renderChangeTaskLock(appliedIntake));
      return;
    }
    case 'diff': {
      console.log(renderChangeDiff(workspace));
      return;
    }
    case 'rollback': {
      const restoredPath = rollbackChange(workspace);
      console.log(`Rollback restored ${path.relative(workspace.repoRoot, restoredPath)}`);
      return;
    }
    case 'gate': {
      const intake = readChangeCurrent(workspace);
      const report = evaluateChangeGate(intake);
      captureChangeMemory(workspace, intake, report, workspace.activeHostName);
      recordHostReflection(workspace, intake, report, workspace.activeHostName);
      if (report.ready) {
        learnMemory(workspace.repoRoot, workspace.activeHostName, 2, true);
        teachHostMemory(workspace.repoRoot, workspace.activeHostName);
        generateLearningPack(workspace.repoRoot, workspace.activeHostName);
      }
      writeChangeRecord(workspace, {
        ...intake,
        gatedAt: new Date().toISOString(),
        ready: report.ready,
        state: report.ready ? 'ready' : 'blocked',
      }, 'gate');
      console.log(renderChangeGate(report));
      process.exit(report.ready ? 0 : 1);
      return;
    }
    case 'memory-suggest': {
      handleMemorySuggest(workspace);
      return;
    }
    default:
      console.error(`Unknown change action: ${action}`);
      process.exit(1);
  }
}

async function handleStatus(workspace, flags, positional) {
  const action = positional[0] || 'show';
  switch (action) {
    case 'show':
      console.log(renderStatusLine(readStatusCurrent(workspace)));
      return;
    case 'who':
      console.log(renderStatusLine(readStatusCurrent(workspace)));
      return;
    case 'set': {
      const snapshot = buildStatusSnapshot(workspace, flags, readStatusCurrent(workspace));
      writeStatusRecord(workspace, snapshot, 'set');
      console.log(renderStatusLine(snapshot));
      return;
    }
    case 'heartbeat': {
      const snapshot = buildHeartbeatSnapshot(readStatusCurrent(workspace));
      writeStatusRecord(workspace, snapshot, 'heartbeat');
      console.log(renderStatusLine(snapshot));
      return;
    }
    case 'attach': {
      if (!flags.task || !flags.route) {
        console.error('Usage: agent-system status attach --agent <id> --task <text> --route <text>');
        process.exit(1);
      }
      const snapshot = buildAttachSnapshot(workspace, flags, readStatusCurrent(workspace));
      writeStatusRecord(workspace, snapshot, 'attach');
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
    ['change schema exists', () => fs.existsSync(workspace.changeSchemaPath)],
    ['change snapshot exists', () => fs.existsSync(workspace.changeCurrentPath)],
    ['change history exists', () => fs.existsSync(workspace.changeHistoryPath)],
    ['change readme exists', () => fs.existsSync(workspace.changeReadmePath)],
    ['change template exists', () => fs.existsSync(workspace.changeTemplatePath)],
    ['change memory exists', () => fs.existsSync(workspace.changeMemoryPath) || hasAnyChangeMemoryFile(workspace.repoRoot)],
    ['command script exists', () => fs.existsSync(path.join(workspace.repoRoot, 'bin', 'agent-system.mjs'))],
    ['memory audit clean', () => auditMemory(workspace.repoRoot, workspace.manifest, workspace.profile, workspace.activeHostName).ok],
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
    host: workspace.activeHostName,
    manifest: workspace.manifest,
    profile,
    profileDoc: fs.readFileSync(profileDocPath, 'utf8'),
    memory: {
      system: readOptionalText(path.join(workspace.repoRoot, workspace.manifest.memory?.system || 'memory/system.md')),
      profile: readOptionalText(path.join(workspace.repoRoot, profile.memory?.profileMemory || `memory/profile/${profileName}.md`)),
      change: readOptionalText(workspace.changeMemoryPath),
      packs: readOptionalText(workspace.packMemoryPath),
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
  if (bundle.memory?.change) {
    const hostName = normalizeHostName(bundle?.host || process.env.AGENT_SYSTEM_HOST || 'qwen');
    const changeMemoryPath = resolveHostMemoryPath(repoRoot, hostName, 'change');
    fs.mkdirSync(path.dirname(changeMemoryPath), { recursive: true });
    fs.writeFileSync(changeMemoryPath, bundle.memory.change, 'utf8');
  }
  if (bundle.memory?.packs) {
    const hostName = normalizeHostName(bundle?.host || process.env.AGENT_SYSTEM_HOST || 'qwen');
    const packMemoryPath = resolveHostMemoryPath(repoRoot, hostName, 'packs');
    fs.mkdirSync(path.dirname(packMemoryPath), { recursive: true });
    fs.writeFileSync(packMemoryPath, bundle.memory.packs, 'utf8');
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

function auditMemory(repoRoot, manifest, profile, hostName) {
  const issues = [];
  const profileName = profile?.profile || 'imphub';
  const system = readOptionalText(path.join(repoRoot, manifest.memory?.system || 'memory/system.md'));
  const profileText = readOptionalText(path.join(repoRoot, profile?.memory?.profileMemory || `memory/profile/${profileName}.md`));
  const changeText = readOptionalText(resolveHostMemoryPath(repoRoot, hostName || 'qwen', 'change'));
  const hostGeneric = readOptionalText(path.join(repoRoot, manifest.memory?.host?.generic || 'memory/host/generic.md'));

  if (!system.includes('Superpowers decides process')) issues.push('system memory missing core authority rule');
  if (!system.includes('Structured manifests are authoritative')) issues.push('system memory missing manifest authority rule');
  if (!profileText.includes('Durable lessons and preferences')) issues.push('profile memory missing durable lessons note');
  if (!profileText.includes('Do not silently move ownership')) issues.push('profile memory missing ownership guard');
  if (!changeText.includes('Change-specific lessons')) issues.push('change memory missing capture note');
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
    manifest.memory?.change,
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
  let change = 0;
  let packs = 0;
  for (const file of files) {
    const relative = path.relative(repoRoot, file);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    entries += lines.filter((line) => line.trim().startsWith('- ')).length;
    if (relative.startsWith(`memory${path.sep}system`)) system += 1;
    else if (relative.startsWith(`memory${path.sep}profile${path.sep}`)) profile += 1;
    else if (relative.startsWith(`memory${path.sep}host${path.sep}`)) host += 1;
    else if (relative.startsWith(`memory${path.sep}change${path.sep}`)) change += 1;
    else if (relative.startsWith(`memory${path.sep}packs${path.sep}`)) packs += 1;
  }
  return { files: files.length, entries, system, profile, host, change, packs };
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
      change: `memory/change/${nextName}.md`,
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

function ensureMemoryChangeFile(repoRoot, hostName) {
  const filePath = resolveHostMemoryPath(repoRoot, hostName, 'change');
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `# ${humanize(hostName)} Change Memory\n\nChange-specific lessons captured from gates and scouts live here.\n`, 'utf8');
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
  } else if (target === 'packs') {
    files.push(...walkFiles(path.join(repoRoot, 'memory', 'packs')).map((file) => path.relative(repoRoot, file)));
  } else {
    files.push('memory/system.md');
    files.push(...walkFiles(path.join(repoRoot, 'memory', 'profile')).map((file) => path.relative(repoRoot, file)));
    files.push(...walkFiles(path.join(repoRoot, 'memory', 'host')).map((file) => path.relative(repoRoot, file)));
    files.push(...walkFiles(path.join(repoRoot, 'memory', 'packs')).map((file) => path.relative(repoRoot, file)));
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
  if (target.startsWith('packs:')) {
    const host = target.split(':')[1];
    return path.join(repoRoot, 'memory', 'packs', `${host}.md`);
  }
  return path.join(repoRoot, 'memory', 'system.md');
}

function appendMemoryEntry(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const next = `${current.trimEnd()}\n\n- ${text}\n`;
  fs.writeFileSync(filePath, next, 'utf8');
}

function createEmptyChangeIntake(workspace) {
  return {
    type: null,
    name: null,
    target: null,
    intent: '',
    processSkill: 'brainstorming',
    routeSelected: '',
    classification: [],
    ownedDomains: [],
    baselineFile: null,
    regressionMatrix: null,
    oldNewMapping: null,
    stopLineRisks: [],
    sourceFiles: [],
    ready: false,
    state: 'draft',
    createdAt: null,
    scoutedAt: null,
    scaffoldedAt: null,
    updatedAt: null,
    gatedAt: null,
    profile: workspace.activeProfileName,
  };
}

function readChangeCurrent(workspace) {
  const filePath = workspace.changeCurrentPath;
  if (!fs.existsSync(filePath)) {
    return createEmptyChangeIntake(workspace);
  }
  try {
    return {
      ...createEmptyChangeIntake(workspace),
      ...readJson(filePath),
    };
  } catch {
    return createEmptyChangeIntake(workspace);
  }
}

function readChangeHistory(workspace) {
  const filePath = workspace.changeHistoryPath;
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const entries = [];
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      continue;
    }
  }
  return entries;
}

function createEmptyChangeSignals() {
  return {
    sourceFiles: [],
    target: '',
    type: '',
    intent: '',
    routeSelected: '',
    baselineFile: '',
    regressionMatrix: '',
    oldNewMapping: '',
    scoutedAt: null,
  };
}

function collectChangeSignals(workspace) {
  const now = new Date().toISOString();
  const repoStatus = collectGitStatus(workspace.repoRoot);
  const sourceFiles = repoStatus.map((entry) => entry.file);
  const target = inferPrimaryChangeTarget(sourceFiles);
  const type = inferChangeTypeFromSignals(repoStatus, target);
  return {
    sourceFiles,
    target,
    type,
    intent: summarizeChangeIntent(sourceFiles, type, target),
    routeSelected: inferChangeRoute(type),
    baselineFile: inferBaselineFile(type, target),
    regressionMatrix: inferRegressionMatrix(type),
    oldNewMapping: inferOldNewMapping(type, target),
    scoutedAt: now,
  };
}

function collectGitStatus(repoRoot) {
  const result = spawnSync('git', ['-C', repoRoot, 'status', '--porcelain=v1', '--untracked-files=all'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return [];
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const file = line.slice(3).trim();
      return {
        status: line.slice(0, 2).trim(),
        file,
      };
    });
}

function inferPrimaryChangeTarget(sourceFiles) {
  if (!Array.isArray(sourceFiles) || sourceFiles.length === 0) {
    return '';
  }
  const ranked = sourceFiles.find((file) => !isIgnorableChangeFile(file));
  return ranked || sourceFiles[0] || '';
}

function isIgnorableChangeFile(file) {
  const text = String(file || '').toLowerCase();
  return text.startsWith('docs/') || text.startsWith('templates/') || text.startsWith('memory/') || text.startsWith('change/') || text.startsWith('status/') || text === 'readme.md' || text === 'agents.md';
}

function inferChangeTypeFromSignals(repoStatus, target) {
  if (!target) {
    return 'update';
  }
  if (target.startsWith('profiles/') || target.startsWith('change/') || target.startsWith('memory/')) {
    return 'update';
  }
  const statusText = repoStatus.map((entry) => entry.status).join(' ');
  if (statusText.includes('??')) {
    return 'new-project';
  }
  return 'update';
}

function summarizeChangeIntent(sourceFiles, type, target) {
  if (target) {
    return `${humanizeChangeType(type)} ${target}`;
  }
  if (Array.isArray(sourceFiles) && sourceFiles.length > 0) {
    return `${humanizeChangeType(type)} ${sourceFiles.slice(0, 3).join(', ')}`;
  }
  return `${humanizeChangeType(type)} current workspace`;
}

function humanizeChangeType(type) {
  const normalized = String(type || 'update').replace(/-/g, ' ').trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function writeChangeRecord(workspace, intake, eventType) {
  const now = new Date().toISOString();
  const current = {
    ...createEmptyChangeIntake(workspace),
    ...intake,
    updatedAt: now,
  };
  fs.mkdirSync(path.dirname(workspace.changeCurrentPath), { recursive: true });
  fs.writeFileSync(workspace.changeCurrentPath, JSON.stringify(current, null, 2) + '\n', 'utf8');

  const history = readChangeHistory(workspace);
  const record = {
    ...current,
    eventType,
    sequence: history.length + 1,
    recordedAt: now,
  };
  fs.mkdirSync(path.dirname(workspace.changeHistoryPath), { recursive: true });
  fs.appendFileSync(workspace.changeHistoryPath, JSON.stringify(record) + '\n', 'utf8');
  return current;
}

function buildChangeIntake(workspace, flags, current, auto = false) {
  const now = new Date().toISOString();
  const currentIntake = current || createEmptyChangeIntake(workspace);
  const repoSignals = auto ? collectChangeSignals(workspace) : createEmptyChangeSignals();
  const type = flags.type || currentIntake.type || repoSignals.type || 'update';
  const target = flags.target || currentIntake.target || repoSignals.target || inferChangeTarget(type, flags.name);
  const name = flags.name || currentIntake.name || inferChangeName(target, workspace.activeProfileName);
  const intent = flags.intent || currentIntake.intent || repoSignals.intent || '';
  const classification = normalizeChangeList(flags.classification || currentIntake.classification);
  const ownedDomains = normalizeChangeList(flags.ownedDomains || currentIntake.ownedDomains);
  const resolvedClassification = classification.length > 0 ? classification : inferChangeClassifications(type, target, intent);
  const resolvedOwnedDomains = ownedDomains.length > 0 ? ownedDomains : resolvedClassification.slice();
  const baselineFile = flags.baseline || currentIntake.baselineFile || repoSignals.baselineFile || inferBaselineFile(type, target);
  const regressionMatrix = flags.regressionMatrix || currentIntake.regressionMatrix || repoSignals.regressionMatrix || inferRegressionMatrix(type);
  const oldNewMapping = flags.oldNew || currentIntake.oldNewMapping || repoSignals.oldNewMapping || inferOldNewMapping(type, target);
  const routeSelected = flags.route || currentIntake.routeSelected || repoSignals.routeSelected || inferChangeRoute(type);
  const stopLineRisks = inferChangeRisks(type, target, intent, baselineFile, regressionMatrix, oldNewMapping, resolvedOwnedDomains);
  const candidate = {
    ...currentIntake,
    type,
    name,
    target,
    intent,
    processSkill: 'brainstorming',
    routeSelected,
    classification: resolvedClassification,
    ownedDomains: resolvedOwnedDomains,
    baselineFile,
    regressionMatrix,
    oldNewMapping,
    stopLineRisks,
    profile: workspace.activeProfileName,
    sourceFiles: repoSignals.sourceFiles,
    createdAt: currentIntake.createdAt || now,
    scoutedAt: currentIntake.scoutedAt || repoSignals.scoutedAt || now,
    updatedAt: now,
  };
  const gate = evaluateChangeGate(candidate);
  return {
    ...candidate,
    ready: gate.ready,
    state: gate.ready ? 'ready' : 'draft',
    gatedAt: gate.ready ? now : currentIntake.gatedAt || null,
  };
}

function scaffoldChangeWorkspace(workspace, intake) {
  fs.mkdirSync(workspace.changeDir, { recursive: true });
  fs.writeFileSync(workspace.changeCurrentPath, JSON.stringify(intake, null, 2) + '\n', 'utf8');
  const intakeDoc = renderChangeIntakeDoc(intake, workspace);
  const intakeDocPath = path.join(workspace.changeDir, 'intake.md');
  fs.writeFileSync(intakeDocPath, intakeDoc, 'utf8');
  if (!fs.existsSync(workspace.changeHistoryPath)) {
    fs.writeFileSync(workspace.changeHistoryPath, '', 'utf8');
  }
}

function renderChangeTaskLock(intake) {
  const lines = [];
  lines.push('[TASK LOCK]');
  lines.push(`Task type: ${intake.type || 'unknown'}`);
  lines.push(`Target file: ${intake.target || 'n/a'}`);
  lines.push(`Route selected: ${intake.routeSelected || 'n/a'}`);
  lines.push(`Process skill: ${intake.processSkill || 'brainstorming'}`);
  lines.push(`Change classification: ${formatList(intake.classification)}`);
  lines.push(`Baseline file: ${intake.baselineFile || 'n/a'}`);
  lines.push(`Owned domains: ${formatList(intake.ownedDomains)}`);
  lines.push(`Stop-line risks: ${formatList(intake.stopLineRisks)}`);
  return lines.join('\n');
}

function evaluateChangeGate(intake) {
  const type = intake?.type || 'unknown';
  const needsBaseline = type !== 'new-project';
  const needsRegression = type !== 'new-project';
  const hasTarget = isFilled(intake?.target);
  const hasIntent = isFilled(intake?.intent);
  const hasClassification = Array.isArray(intake?.classification) && intake.classification.length > 0;
  const hasOwnedDomains = Array.isArray(intake?.ownedDomains) && intake.ownedDomains.length > 0;
  const hasBaseline = !needsBaseline || fileExistsForChangePath(intake?.baselineFile);
  const hasRegression = !needsRegression || fileExistsForChangePath(intake?.regressionMatrix);
  const hasOldNew = !needsRegression || isFilled(intake?.oldNewMapping);
  const openRisks = Array.isArray(intake?.stopLineRisks) ? intake.stopLineRisks.filter(Boolean) : [];
  const ready = hasTarget && hasIntent && hasClassification && hasOwnedDomains && hasBaseline && hasRegression && hasOldNew;
  return {
    type,
    intakeCaptured: hasTarget && hasIntent,
    baselineUpdated: hasBaseline,
    regressionMatrix: hasRegression,
    oldNewMapping: hasOldNew,
    ownedDomainsClosed: hasOwnedDomains,
    openRisks,
    ready,
  };
}

function captureChangeMemory(workspace, intake, report, hostName) {
  const normalizedHost = normalizeHostName(hostName || workspace.activeHostName);
  ensureMemoryChangeFile(workspace.repoRoot, normalizedHost);
  const filePath = resolveHostMemoryPath(workspace.repoRoot, normalizedHost, 'change');
  const target = intake?.target || 'unknown target';
  const type = intake?.type || 'unknown';
  const classification = formatList(intake?.classification);
  const domains = formatList(intake?.ownedDomains);
  const stamp = new Date().toISOString();
  const line = report?.ready
    ? `Gate passed for ${type} change targeting ${target}; classification: ${classification}; domains: ${domains}.`
    : `Gate blocked for ${type} change targeting ${target}; missing: ${formatList([
        report?.intakeCaptured ? '' : 'intent/target',
        report?.baselineUpdated ? '' : 'baseline',
        report?.regressionMatrix ? '' : 'regression matrix',
        report?.oldNewMapping ? '' : 'old->new mapping',
        report?.ownedDomainsClosed ? '' : 'owned domains',
      ].filter(Boolean))}; risks: ${formatList(report?.openRisks || [])}.`;
  appendMemoryEntry(filePath, `${stamp} ${line}`);
}

function fileExistsForChangePath(value) {
  if (!isFilled(value)) {
    return false;
  }
  const text = String(value).trim();
  if (text === 'n/a' || text === 'none') {
    return true;
  }
  return fs.existsSync(path.resolve(findRepoRoot(process.cwd()) || process.cwd(), text));
}

function renderChangeGate(report) {
  const lines = [];
  lines.push('[CHANGE GATE]');
  lines.push(`Change type: ${report.type || 'unknown'}`);
  lines.push(`Intake captured: ${formatYesNo(report.intakeCaptured)}`);
  lines.push(`Baseline updated: ${formatYesNo(report.baselineUpdated)}`);
  lines.push(`Regression matrix: ${formatYesNo(report.regressionMatrix)}`);
  lines.push(`Old->new mapping: ${formatYesNo(report.oldNewMapping)}`);
  lines.push(`Owned domains closed: ${formatYesNo(report.ownedDomainsClosed)}`);
  lines.push(`Open risks: ${formatList(report.openRisks)}`);
  lines.push(`Blocked / Ready: ${report.ready ? 'Ready' : 'Blocked'}`);
  return lines.join('\n');
}

function renderChangePreview(intake, report) {
  const lines = [];
  lines.push('[CHANGE PREVIEW]');
  lines.push(`Change type: ${intake.type || 'unknown'}`);
  lines.push(`Target file: ${intake.target || 'n/a'}`);
  lines.push(`Gate status: ${report.ready ? 'Ready' : 'Blocked'}`);
  lines.push(`Missing proof: ${formatList([
    report.intakeCaptured ? '' : 'intent/target',
    report.baselineUpdated ? '' : 'baseline',
    report.regressionMatrix ? '' : 'regression matrix',
    report.oldNewMapping ? '' : 'old->new mapping',
    report.ownedDomainsClosed ? '' : 'owned domains',
  ].filter(Boolean))}`);
  lines.push(`Open risks: ${formatList(report.openRisks)}`);
  return lines.join('\n');
}

function renderChangeDiff(workspace) {
  const current = readChangeCurrent(workspace);
  const history = readChangeHistory(workspace);
  const lastGate = [...history].reverse().find((entry) => entry.eventType === 'gate') || history[history.length - 1] || null;
  const lines = [];
  lines.push('[CHANGE DIFF]');
  lines.push(`Current type: ${current.type || 'unknown'}`);
  lines.push(`Current target: ${current.target || 'n/a'}`);
  lines.push(`Last gate type: ${lastGate?.type || 'unknown'}`);
  lines.push(`Last gate state: ${lastGate?.state || 'unknown'}`);
  lines.push(`Changed since gate: ${current.updatedAt && lastGate?.updatedAt && current.updatedAt !== lastGate.updatedAt ? 'yes' : 'no'}`);
  return lines.join('\n');
}

function rollbackChange(workspace) {
  const history = readChangeHistory(workspace);
  if (history.length === 0) {
    const fallback = createEmptyChangeIntake(workspace);
    writeChangeRecord(workspace, fallback, 'rollback');
    fs.writeFileSync(workspace.changeCurrentPath, JSON.stringify(fallback, null, 2) + '\n', 'utf8');
    return workspace.changeCurrentPath;
  }
  const snapshot = [...history].reverse().find((entry) => entry.eventType !== 'rollback') || history[history.length - 1];
  const restored = {
    ...createEmptyChangeIntake(workspace),
    ...snapshot,
    updatedAt: new Date().toISOString(),
    state: snapshot.state || 'draft',
  };
  fs.writeFileSync(workspace.changeCurrentPath, JSON.stringify(restored, null, 2) + '\n', 'utf8');
  writeChangeRecord(workspace, restored, 'rollback');
  return workspace.changeCurrentPath;
}

function handleMemorySuggest(workspace) {
  const filePath = workspace.changeMemoryPath;
  const text = readOptionalText(filePath);
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('- '));
  const counts = new Map();
  const suggestions = [];
  for (const line of lines) {
    const normalized = line.slice(2).trim().toLowerCase();
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  for (const [line, count] of counts.entries()) {
    if (count > 1) {
      suggestions.push(`Promote duplicate lesson to profile memory: ${line}`);
    }
  }
  for (const line of lines) {
    const body = line.slice(2).trim();
    if (/gate passed/i.test(body)) {
      suggestions.push(`Promote durable gate lesson to profile memory: ${body}`);
    }
  }
  console.log('[MEMORY SUGGEST]');
  console.log(`Source: ${path.relative(workspace.repoRoot, filePath)}`);
  if (suggestions.length === 0) {
    console.log('Suggested promotions: none');
    return;
  }
  console.log('Suggested promotions:');
  for (const suggestion of suggestions) {
    console.log(`- ${suggestion}`);
  }
}

function learnMemory(repoRoot, hostName, threshold, apply) {
  const normalizedHost = normalizeHostName(hostName);
  const changePath = resolveHostMemoryPath(repoRoot, normalizedHost, 'change');
  const hostPath = resolveHostMemoryPath(repoRoot, normalizedHost, 'host');
  const changeEntries = readMemoryBullets(changePath);
  const hostEntries = readMemoryBullets(hostPath);
  const counts = new Map();
  const order = [];

  for (const entry of changeEntries) {
    const key = normalizeMemoryBullet(entry);
    if (!counts.has(key)) {
      counts.set(key, { text: entry, count: 0 });
      order.push(key);
    }
    counts.get(key).count += 1;
  }

  const promotions = [];
  const duplicateLines = [];
  const hostSet = new Set(hostEntries.map((entry) => normalizeMemoryBullet(entry)));

  for (const key of order) {
    const entry = counts.get(key);
    if (!entry || entry.count < threshold) {
      continue;
    }
    duplicateLines.push(entry.text);

    if (!hostSet.has(key)) {
      promotions.push({ target: normalizedHost, text: entry.text });
      if (apply) {
        appendMemoryEntry(hostPath, stripBulletPrefix(entry.text));
        hostSet.add(key);
      }
    }
  }

  if (apply && promotions.length > 0) {
    pruneMemory(repoRoot);
  }

  return {
    threshold,
    applied: apply,
    promoted: promotions.length,
    duplicates: duplicateLines,
    promotions,
  };
}

function readMemoryBullets(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '));
}

function normalizeMemoryBullet(text) {
  return String(text || '').replace(/^\-\s+/, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function stripBulletPrefix(text) {
  return String(text || '').replace(/^\-\s+/, '').trim();
}

function isUniversalMemoryRule(text) {
  const lowered = String(text || '').toLowerCase();
  if (lowered.includes('host:') || lowered.includes('claude') || lowered.includes('qwen') || lowered.includes('codex')) {
    return false;
  }
  if (lowered.includes('imphub') || lowered.includes('profile') || lowered.includes('change memory')) {
    return false;
  }
  return lowered.includes('superpowers') || lowered.includes('agent system') || lowered.includes('route') || lowered.includes('memory');
}

function isWeakMemoryRule(text) {
  const lowered = String(text || '').toLowerCase().replace(/^\-\s+/, '').trim();
  if (!lowered) {
    return true;
  }
  if (lowered.length < 12) {
    return true;
  }
  return /todo|maybe|temp|placeholder|unknown|fix later|not sure/.test(lowered);
}

function renderChangeIntakeDoc(intake, workspace) {
  const template = readOptionalText(workspace.changeTemplatePath);
  const values = {
    type: intake.type || 'update',
    name: intake.name || 'change',
    target: intake.target || '',
    intent: intake.intent || '',
    processSkill: intake.processSkill || 'brainstorming',
    routeSelected: intake.routeSelected || '',
    classification: formatList(intake.classification),
    ownedDomains: formatList(intake.ownedDomains),
    baselineFile: intake.baselineFile || '',
    regressionMatrix: intake.regressionMatrix || '',
    oldNewMapping: intake.oldNewMapping || '',
    stopLineRisks: formatList(intake.stopLineRisks),
    sourceFiles: formatList(intake.sourceFiles),
    scoutedAt: intake.scoutedAt || '',
    state: intake.state || 'draft',
    profile: intake.profile || workspace.activeProfileName,
  };
  return fillTemplate(template || defaultChangeTemplate(), values);
}

function inferChangeTarget(type, name) {
  if (type === 'new-project' && name) {
    return name;
  }
  return '';
}

function inferChangeName(target, fallback) {
  const base = String(target || fallback || 'change').split(/[\\/]/).filter(Boolean).pop() || 'change';
  return base.replace(/\.m?js$/i, '').replace(/\.md$/i, '');
}

function inferChangeRoute(type) {
  if (type === 'new-project') {
    return 'bootstrap -> scaffold -> validate';
  }
  if (type === 'migration') {
    return 'baseline -> migrate -> regression';
  }
  if (type === 'rewrite') {
    return 'baseline -> rewrite -> verify';
  }
  return 'analyze -> scaffold -> gate';
}

function inferChangeClassifications(type, target, intent) {
  const items = [];
  if (type === 'new-project') {
    items.push('config', 'lifecycle');
  } else {
    items.push('logic', 'regression-risk');
  }
  const text = `${target || ''} ${intent || ''}`.toLowerCase();
  if (text.includes('ui') || text.includes('view') || text.includes('status')) items.push('ui');
  if (text.includes('config') || text.includes('manifest') || text.includes('json')) items.push('config');
  if (text.includes('memory') || text.includes('profile')) items.push('lifecycle');
  if (text.includes('migration') || text.includes('rewrite')) items.push('migration');
  return Array.from(new Set(items));
}

function inferBaselineFile(type, target) {
  if (type === 'new-project') {
    return 'n/a';
  }
  return target ? `docs/baselines/${path.basename(String(target))}.md` : 'docs/baselines/change.md';
}

function inferRegressionMatrix(type) {
  return type === 'new-project' ? 'n/a' : 'templates/regression-matrix.md';
}

function inferOldNewMapping(type, target) {
  if (type === 'new-project') {
    return 'n/a';
  }
  if (!target) {
    return 'n/a';
  }
  return `${target} -> ${target}`;
}

function inferChangeRisks(type, target, intent, baselineFile, regressionMatrix, oldNewMapping, ownedDomains) {
  const risks = [];
  if (!isFilled(target)) risks.push('missing target path');
  if (!isFilled(intent)) risks.push('missing change intent');
  if (type !== 'new-project' && !isFilled(baselineFile)) risks.push('missing baseline file');
  if (type !== 'new-project' && !isFilled(regressionMatrix)) risks.push('missing regression matrix');
  if (type !== 'new-project' && !isFilled(oldNewMapping)) risks.push('missing old->new mapping');
  if (!Array.isArray(ownedDomains) || ownedDomains.length === 0) risks.push('missing owned domains');
  return risks;
}

function normalizeChangeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatList(value) {
  const items = Array.isArray(value) ? value : normalizeChangeList(value);
  return items.length > 0 ? items.join(', ') : 'n/a';
}

function formatYesNo(value) {
  return value ? 'yes' : 'no';
}

function fillTemplate(template, values) {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value ?? ''));
  }
  return output;
}

function defaultChangeTemplate() {
  return [
    '# {{name}}',
    '',
    '## Intent',
    '',
    '{{intent}}',
    '',
    '## Change Summary',
    '',
    '- Type: {{type}}',
    '- Target: {{target}}',
    '- Route: {{routeSelected}}',
    '- Process skill: {{processSkill}}',
    '- Classification: {{classification}}',
    '- Owned domains: {{ownedDomains}}',
    '- Baseline file: {{baselineFile}}',
    '- Regression matrix: {{regressionMatrix}}',
    '- Old -> new mapping: {{oldNewMapping}}',
    '- Stop-line risks: {{stopLineRisks}}',
    '- Source files: {{sourceFiles}}',
    '- Scouted at: {{scoutedAt}}',
    '',
    '## Delivery Gate',
    '',
    '- State: {{state}}',
    '- Profile: {{profile}}',
  ].join('\n');
}

function buildHeartbeatSnapshot(current) {
  const now = new Date().toISOString();
  return {
    ...current,
    updatedAt: now,
    heartbeatAt: now,
  };
}

function buildAttachSnapshot(workspace, flags, current) {
  const now = new Date().toISOString();
  const currentSnapshot = current || createIdleStatusSnapshot();
  const agent = flags.agent || currentSnapshot.agent || normalizeAgentName(flags.name || flags.task || flags.route || 'agent');
  const name = flags.name || (flags.agent ? humanizeAgentName(flags.agent) : currentSnapshot.name || humanizeAgentName(agent));
  const task = flags.task || currentSnapshot.task || '';
  const route = flags.route || currentSnapshot.route || '';
  const action = flags.action || `Attached to ${task}`;
  const currentScope = currentSnapshot.scope && currentSnapshot.scope !== 'none' ? currentSnapshot.scope : '';
  const scope = flags.scope || currentScope || inferScopeFromRoute(route) || inferScopeFromAgent(agent);
  const state = flags.state || 'working';
  const profile = workspace.activeProfileName;
  const active = true;
  const startedAt = currentSnapshot.active && currentSnapshot.agent === agent && currentSnapshot.scope === scope && currentSnapshot.startedAt
    ? currentSnapshot.startedAt
    : now;

  return {
    ...currentSnapshot,
    agent,
    name,
    action,
    state,
    scope,
    task,
    route,
    profile,
    attachedAt: currentSnapshot.attachedAt || now,
    heartbeatAt: currentSnapshot.heartbeatAt || null,
    startedAt,
    updatedAt: now,
    eta: flags.eta || currentSnapshot.eta || null,
    detail: flags.detail || currentSnapshot.detail || '',
    active,
  };
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
  const hasIntent = Boolean(flags.agent || flags.name || flags.action || flags.state || flags.scope || flags.eta || flags.detail || flags.task || flags.route);
  const agent = flags.agent || (currentSnapshot.active ? currentSnapshot.agent : null) || normalizeAgentName(flags.name || currentSnapshot.name || currentSnapshot.scope || flags.task || 'agent');
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
    task: flags.task || currentSnapshot.task || null,
    route: flags.route || currentSnapshot.route || null,
    profile: currentSnapshot.profile || workspace.activeProfileName,
    attachedAt: currentSnapshot.attachedAt || null,
    heartbeatAt: currentSnapshot.heartbeatAt || null,
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
    task: null,
    route: null,
    profile: null,
    attachedAt: null,
    heartbeatAt: null,
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
  if (status.task) {
    parts.push(`task=${status.task}`);
  }
  if (status.route) {
    parts.push(`route=${status.route}`);
  }
  if (status.profile) {
    parts.push(`profile=${status.profile}`);
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

function inferScopeFromRoute(route) {
  const normalized = String(route || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  if (normalized.includes('audit')) {
    return 'audit';
  }
  if (normalized.includes('farm')) {
    return 'farm-loop';
  }
  if (normalized.includes('route')) {
    return 'route-sync';
  }
  return '';
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
