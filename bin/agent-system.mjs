#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildDeliveryGateReport, renderDeliveryGate } from '../lib/artifacts.mjs';
import { buildBrainDedupeReport, renderBrainDedupeReport } from '../lib/brain-hygiene.mjs';
import {
  buildUpgradeReplayReport,
  ensureUpgradeWorkspace,
  renderUpgradeReplayReport,
  writeUpgradeSession,
} from '../lib/upgrade.mjs';

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
    case 'quick-update':
      handleQuickUpdate(workspace, flags, positional);
      return;
    case 'upgrade':
      handleUpgrade(workspace, flags, positional);
      return;
    case 'quick-fix':
      handleQuickFix(workspace, flags, positional);
      return;
    case 'luau-quick':
      handleLuauQuick(workspace, flags, positional);
      return;
    case 'luau-explain':
      handleLuauExplain(workspace, flags, positional);
      return;
    case 'luau-diagnose':
      handleLuauDiagnose(workspace, flags, positional);
      return;
    case 'luau-repair':
      handleLuauRepair(workspace, flags, positional);
      return;
    case 'luau-gate':
      handleLuauGate(workspace, flags, positional);
      return;
    case 'train':
      handleTrain(workspace, flags, positional);
      return;
    case 'luau-train':
      handleTrain(workspace, { ...flags, luau: true }, positional);
      return;
    case 'eval':
      handleEval(workspace, flags, positional);
      return;
    case 'luau-eval':
      handleEval(workspace, { ...flags, luau: true }, positional);
      return;
    case 'route':
      printRouteSummary(workspace, await readTaskText(positional));
      return;
    case 'explain':
      printRouteSummary(workspace, await readTaskText(positional), true);
      return;
    case 'gate':
      handleGate(await readGateText(positional, flags));
      return;
    case 'delivery-check':
      handleDeliveryCheck(workspace);
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
    case 'brain':
      handleBrain(workspace, flags, positional);
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
    case 'brain-add':
      handleBrainAdd(workspace, flags, positional);
      return;
    case 'brain-query':
      handleBrainQuery(workspace, flags, positional);
      return;
    case 'brain-explain':
      handleBrainExplain(workspace, flags, positional);
      return;
    case 'brain-promote':
      handleBrainPromote(workspace, flags, positional);
      return;
    case 'brain-demote':
      handleBrainDemote(workspace, flags, positional);
      return;
    case 'brain-prune':
      handleBrainPrune(workspace);
      return;
    case 'brain-snapshot':
      handleBrainSnapshot(workspace, flags, positional);
      return;
    case 'brain-restore':
      handleBrainRestore(workspace, flags, positional);
      return;
    case 'brain-diff':
      handleBrainDiff(workspace, flags, positional);
      return;
    case 'brain-sync':
      handleBrainSync(workspace);
      return;
    case 'backup':
      handleBackup(workspace, flags, positional);
      return;
    case 'restore':
      handleRestore(workspace, flags, positional);
      return;
    case 'bundle':
      handleBundle(workspace, flags, positional);
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
    if (arg === '--title') {
      flags.title = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--summary') {
      flags.summary = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--source') {
      flags.source = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--status') {
      flags.status = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--confidence') {
      flags.confidence = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--fact') {
      flags.fact = flags.fact || [];
      flags.fact.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--tag') {
      flags.tag = flags.tag || [];
      flags.tag.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--path') {
      flags.path = flags.path || [];
      flags.path.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--reason') {
      flags.reason = argv[i + 1];
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
    '  quick-update Prepare a fast update intake from target + intent',
    '  upgrade    Apply multi-agent instruction and memory upgrades',
    '    apply    Write the current upgrade session and refresh docs',
    '    sync     Rebuild the current upgrade trail in place',
    '    replay   Compare the current docs against the last upgrade session',
    '  quick-fix  Handle a single-file code/config fix with a fast path',
    '  luau-quick Handle a single-file Luau fix with a Luau-specific fast path',
    '  luau-explain Explain the selected Luau route and repair proof',
    '  luau-diagnose Diagnose Luau-specific failure patterns',
    '  luau-repair Apply an automatic multi-file Luau repair',
    '  luau-gate  Validate a Luau repair snapshot',
    '  train      Train multiple agents and sync training memory and docs',
    '  luau-train Train Luau-aware lessons and sync Luau memory focus',
    '    rollback Restore the latest active host training snapshot',
    '  eval       Simulate, score, compare, and promote evaluation runs',
    '  luau-eval  Simulate and score Luau-aware evaluation runs',
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
    '    snapshot Capture the active host learning state for rollback',
    '    restore  Restore the active host learning state from a snapshot',
    '    diff     Compare the active host learning state against a snapshot',
    '    rollback Restore the latest active host learning snapshot',
    '  brain     Query and manage the structured second brain',
    '    add      Add a structured brain entry',
    '    query    Search the brain for matching knowledge',
    '    explain  Explain why a brain entry matched',
    '    promote  Promote a brain entry to a stronger scope',
    '    demote   Demote a brain entry to a weaker scope',
    '    prune    Rebuild the brain index and drop duplicate noise',
    '    dedupe   Report deterministic merge candidates for duplicate notes',
    '    snapshot Capture the current brain state',
    '    restore  Restore the brain from a snapshot',
    '    diff     Compare the current brain state against a snapshot',
    '    sync     Rebuild the materialized brain index',
    '  delivery-check Validate the executable delivery gate for the current workspace',
    '  backup    Snapshot the current mutable workspace state',
    '    validate Validate a generated backup bundle',
    '  restore   Restore a previously captured backup snapshot',
    '  bundle    Validate, diff, or prune backup bundles',
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
  const trainingDir = path.join(repoRoot, manifest.paths?.training || 'docs/training');
  const trainingCurrentPath = path.join(repoRoot, manifest.training?.current || 'docs/training/current.json');
  const trainingHistoryPath = path.join(repoRoot, manifest.training?.history || 'docs/training/history.jsonl');
  const trainingReadmePath = path.join(repoRoot, manifest.training?.readme || 'docs/training/README.md');
  const trainingSchemaPath = path.join(repoRoot, manifest.training?.schema || 'docs/training-schema.md');
  const trainingContinuousPath = path.join(repoRoot, manifest.training?.continuous || 'docs/training/continuous.json');
  const trainingContinuousHistoryPath = path.join(repoRoot, manifest.training?.continuousHistory || 'docs/training/continuous-history.jsonl');
  const trainingContinuousReadmePath = path.join(repoRoot, manifest.training?.continuousReadme || 'docs/training/continuous.md');
  const trainingRecoveryDir = path.join(repoRoot, manifest.training?.recovery || 'docs/training/recovery');
  const evalDir = path.join(repoRoot, manifest.paths?.evals || 'docs/evals');
  const evalCurrentPath = path.join(repoRoot, manifest.eval?.current || 'docs/evals/current.json');
  const evalHistoryPath = path.join(repoRoot, manifest.eval?.history || 'docs/evals/history.jsonl');
  const evalReadmePath = path.join(repoRoot, manifest.eval?.readme || 'docs/evals/README.md');
  const evalSchemaPath = path.join(repoRoot, manifest.eval?.schema || 'docs/evals-schema.md');
  const brainDir = path.join(repoRoot, manifest.paths?.brain || 'docs/brain');
  const brainCurrentPath = path.join(repoRoot, manifest.brain?.current || 'docs/brain/current.json');
  const brainHistoryPath = path.join(repoRoot, manifest.brain?.history || 'docs/brain/history.jsonl');
  const brainReadmePath = path.join(repoRoot, manifest.brain?.readme || 'docs/brain/README.md');
  const brainSchemaPath = path.join(repoRoot, manifest.brain?.schema || 'docs/brain-schema.md');
  const brainSnapshotsDir = path.join(repoRoot, manifest.brain?.snapshots || 'docs/brain/snapshots');
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
    trainingDir,
    trainingCurrentPath,
    trainingHistoryPath,
    trainingReadmePath,
    trainingSchemaPath,
    trainingContinuousPath,
    trainingContinuousHistoryPath,
    trainingContinuousReadmePath,
    trainingRecoveryDir,
    evalDir,
    evalCurrentPath,
    evalHistoryPath,
    evalReadmePath,
    evalSchemaPath,
    brainDir,
    brainCurrentPath,
    brainHistoryPath,
    brainReadmePath,
    brainSchemaPath,
    brainSnapshotsDir,
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
  const { repoRoot, manifest, profile, profilePath, profileDocPath, statusCurrentPath, statusEventsPath, changeCurrentPath, changeHistoryPath, changeReadmePath, changeSchemaPath, changeTemplatePath, changeMemoryPath, trainingCurrentPath, trainingHistoryPath, trainingReadmePath, trainingSchemaPath, evalCurrentPath, evalHistoryPath, evalReadmePath, evalSchemaPath } = workspace;
  const { trainingContinuousPath, trainingContinuousHistoryPath, trainingContinuousReadmePath } = workspace;
  const { brainCurrentPath, brainHistoryPath, brainReadmePath, brainSchemaPath } = workspace;
  const upgradeReadmePath = path.join(repoRoot, 'docs', 'upgrade', 'README.md');
  const upgradeCurrentPath = path.join(repoRoot, 'docs', 'upgrade', 'current.json');
  const upgradeHistoryPath = path.join(repoRoot, 'docs', 'upgrade', 'history.jsonl');
  const upgradeSessionsReadmePath = path.join(repoRoot, 'docs', 'upgrade', 'sessions', 'README.md');
  const luauReadmePath = path.join(repoRoot, 'docs', 'luau', 'README.md');
  const luauCurrentPath = path.join(repoRoot, 'docs', 'luau', 'current.json');
  const luauHistoryPath = path.join(repoRoot, 'docs', 'luau', 'history.jsonl');
  const luauRepairLogPath = path.join(repoRoot, 'docs', 'luau', 'repair-log.md');

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
  if (!fs.existsSync(trainingCurrentPath)) {
    issues.push(`missing training snapshot: ${path.relative(repoRoot, trainingCurrentPath)}`);
  }
  if (!fs.existsSync(trainingHistoryPath)) {
    issues.push(`missing training history: ${path.relative(repoRoot, trainingHistoryPath)}`);
  }
  if (!fs.existsSync(trainingReadmePath)) {
    issues.push(`missing training readme: ${path.relative(repoRoot, trainingReadmePath)}`);
  }
  if (!fs.existsSync(trainingSchemaPath)) {
    issues.push(`missing training schema: ${path.relative(repoRoot, trainingSchemaPath)}`);
  }
  if (!fs.existsSync(trainingContinuousPath)) {
    issues.push(`missing training continuity snapshot: ${path.relative(repoRoot, trainingContinuousPath)}`);
  }
  if (!fs.existsSync(trainingContinuousHistoryPath)) {
    issues.push(`missing training continuity history: ${path.relative(repoRoot, trainingContinuousHistoryPath)}`);
  }
  if (!fs.existsSync(trainingContinuousReadmePath)) {
    issues.push(`missing training continuity readme: ${path.relative(repoRoot, trainingContinuousReadmePath)}`);
  }
  if (!fs.existsSync(brainReadmePath)) {
    issues.push(`missing brain readme: ${path.relative(repoRoot, brainReadmePath)}`);
  }
  if (!fs.existsSync(brainSchemaPath)) {
    issues.push(`missing brain schema: ${path.relative(repoRoot, brainSchemaPath)}`);
  }
  if (!fs.existsSync(brainCurrentPath)) {
    issues.push(`missing brain current snapshot: ${path.relative(repoRoot, brainCurrentPath)}`);
  }
  if (!fs.existsSync(brainHistoryPath)) {
    issues.push(`missing brain history log: ${path.relative(repoRoot, brainHistoryPath)}`);
  }
  if (!fs.existsSync(evalCurrentPath)) {
    issues.push(`missing eval snapshot: ${path.relative(repoRoot, evalCurrentPath)}`);
  }
  if (!fs.existsSync(evalHistoryPath)) {
    issues.push(`missing eval history: ${path.relative(repoRoot, evalHistoryPath)}`);
  }
  if (!fs.existsSync(evalReadmePath)) {
    issues.push(`missing eval readme: ${path.relative(repoRoot, evalReadmePath)}`);
  }
  if (!fs.existsSync(evalSchemaPath)) {
    issues.push(`missing eval schema: ${path.relative(repoRoot, evalSchemaPath)}`);
  }
  if (!fs.existsSync(upgradeReadmePath)) {
    issues.push(`missing upgrade readme: ${path.relative(repoRoot, upgradeReadmePath)}`);
  }
  if (!fs.existsSync(upgradeCurrentPath)) {
    issues.push(`missing upgrade current: ${path.relative(repoRoot, upgradeCurrentPath)}`);
  }
  if (!fs.existsSync(upgradeHistoryPath)) {
    issues.push(`missing upgrade history: ${path.relative(repoRoot, upgradeHistoryPath)}`);
  }
  if (!fs.existsSync(upgradeSessionsReadmePath)) {
    issues.push(`missing upgrade sessions readme: ${path.relative(repoRoot, upgradeSessionsReadmePath)}`);
  }
  if (!fs.existsSync(luauReadmePath)) {
    issues.push(`missing luau repair readme: ${path.relative(repoRoot, luauReadmePath)}`);
  }
  if (!fs.existsSync(luauCurrentPath)) {
    issues.push(`missing luau repair snapshot: ${path.relative(repoRoot, luauCurrentPath)}`);
  }
  if (!fs.existsSync(luauHistoryPath)) {
    issues.push(`missing luau repair history: ${path.relative(repoRoot, luauHistoryPath)}`);
  }
  if (!fs.existsSync(luauRepairLogPath)) {
    issues.push(`missing luau repair log: ${path.relative(repoRoot, luauRepairLogPath)}`);
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
  console.log(`Issues: ${issues.length}`);
  for (const issue of issues) {
    console.log(`- ${issue}`);
  }
  process.exit(1);
}

function handleLint(workspace) {
  const report = buildLintReport(workspace);
  console.log('Lint: ' + (report.ok ? 'OK' : 'FAILED'));
  console.log(`Issues: ${report.items.length}`);
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

function handleDeliveryCheck(workspace) {
  const report = buildDeliveryGateReport(workspace);
  console.log(renderDeliveryGate(report));
  if (report.blockedOrReady !== 'Ready') {
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

  if (action === 'snapshot') {
    handleMemorySnapshot(workspace, flags, positional.slice(1));
    return;
  }

  if (action === 'restore') {
    handleMemoryRestore(workspace, flags, positional.slice(1));
    return;
  }

  if (action === 'diff') {
    handleMemoryDiff(workspace, flags, positional.slice(1));
    return;
  }

  if (action === 'rollback') {
    handleMemoryRollback(workspace, flags, positional.slice(1));
    return;
  }

  if (action === 'demote') {
    handleMemoryDemote(workspace, flags);
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
  console.log(`Duplicates: ${report.duplicates.length}`);
  console.log(`Candidates: ${report.candidates.length}`);
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
  saveLearningSnapshot(workspace.repoRoot, hostName, 'memory-teach');
  captureBrainFromMemory(workspace, hostName, 'teach', `Teach memory refreshed for ${hostName}.`);
  console.log('[MEMORY TEACH]');
  console.log(`Host: ${hostName}`);
  console.log(`Wrote: ${path.relative(workspace.repoRoot, report.targetPath)}`);
  console.log(`Added: ${report.added}`);
}

function handleMemoryGate(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const report = gateHostMemory(workspace.repoRoot, hostName);
  const demoted = !report.ready ? demoteHostMemory(workspace.repoRoot, hostName) : { demoted: [], targetPath: resolveHostMemoryPath(workspace.repoRoot, hostName, 'change') };
  if (!report.ready) {
    saveLearningSnapshot(workspace.repoRoot, hostName, 'memory-gate');
  }
  captureBrainFromMemory(workspace, hostName, 'gate', `Gate ${report.ready ? 'passed' : 'blocked'} for ${hostName}.`, report.ready);
  console.log('[MEMORY GATE]');
  console.log(`Host: ${hostName}`);
  console.log(`Ready: ${report.ready ? 'yes' : 'no'}`);
  console.log(`Reason: ${report.reason}`);
  console.log(`Action: ${report.ready ? 'none' : 'compress -> teach -> gate again'}`);
  console.log(`Demoted: ${demoted.demoted.length}`);
  console.log(`Change memory: ${path.relative(workspace.repoRoot, demoted.targetPath)}`);
}

function handleMemoryReflect(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const intake = readChangeCurrent(workspace);
  const report = evaluateChangeGate(intake);
  const reflection = recordHostReflection(workspace, intake, report, hostName);
  captureBrainFromMemory(workspace, hostName, 'reflect', `Reflection recorded for ${hostName}; ready=${report.ready ? 'yes' : 'no'}.`, report.ready);
  console.log('[MEMORY REFLECT]');
  console.log(`Host: ${hostName}`);
  console.log(`Wrote: ${path.relative(workspace.repoRoot, reflection.targetPath)}`);
}

function handleMemoryDemote(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const report = demoteHostMemory(workspace.repoRoot, hostName);
  saveLearningSnapshot(workspace.repoRoot, hostName, 'memory-demote');
  captureBrainFromMemory(workspace, hostName, 'demote', `Demoted ${report.demoted.length} lessons for ${hostName}.`, false);
  console.log('[MEMORY DEMOTE]');
  console.log(`Host: ${hostName}`);
  console.log(`Demoted: ${report.demoted.length}`);
  console.log(`Change memory: ${path.relative(workspace.repoRoot, report.targetPath)}`);
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
  if (report.applied && report.promoted > 0) {
    saveLearningSnapshot(workspace.repoRoot, hostName, 'memory-learn');
  }
  captureBrainFromMemory(workspace, hostName, 'learn', `Learned ${report.promoted} lessons for ${hostName}; applied=${report.applied ? 'yes' : 'no'}.`, report.promoted > 0);
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
  captureBrainFromChange(workspace, intake, 'memory-capture');
  console.log(`Captured change memory for ${intake.target || 'unknown target'}`);
}

function handleMemorySnapshot(workspace, flags, positional) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const outputPath = flags.files?.[0] || positional[0] || '';
  const report = saveLearningSnapshot(workspace.repoRoot, hostName, 'manual');
  if (outputPath) {
    const absoluteOutputPath = path.isAbsolute(outputPath) ? outputPath : path.resolve(workspace.repoRoot, outputPath);
    fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
    fs.writeFileSync(absoluteOutputPath, JSON.stringify(report.snapshot, null, 2) + '\n', 'utf8');
  }
  console.log(renderLearningSnapshotSnapshot({
    activeHost: hostName,
    activeProfile: report.snapshot.activeProfile,
    fileCount: Object.keys(report.snapshot.files).length,
    latestPath: report.latestPath,
    archivePath: report.archivePath,
    packVersion: report.snapshot.packVersion,
  }));
  if (outputPath) {
    const absoluteOutputPath = path.isAbsolute(outputPath) ? outputPath : path.resolve(workspace.repoRoot, outputPath);
    console.log(`Export: ${path.relative(workspace.repoRoot, absoluteOutputPath)}`);
  }
}

function handleMemoryRestore(workspace, flags, positional) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const inputPath = flags.files?.[0] || positional[0];
  const snapshotSource = inputPath
    ? (path.isAbsolute(inputPath) ? inputPath : path.resolve(workspace.repoRoot, inputPath))
    : readLatestLearningSnapshot(workspace.repoRoot, hostName).snapshotPath;
  if (!snapshotSource) {
    console.error(`No learning snapshot found for host ${hostName}`);
    process.exit(1);
  }
  const snapshot = readLearningSnapshotBundle(snapshotSource);
  if (!snapshot) {
    console.error(`Unable to read learning snapshot: ${snapshotSource}`);
    process.exit(1);
  }
  const restored = restoreLearningSnapshot(workspace.repoRoot, snapshot);
  console.log(renderLearningSnapshotRestore({
    ...restored,
    snapshotPath: snapshotSource,
  }));
}

function handleMemoryDiff(workspace, flags, positional) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const inputPath = flags.files?.[0] || positional[0];
  const snapshotSource = inputPath
    ? (path.isAbsolute(inputPath) ? inputPath : path.resolve(workspace.repoRoot, inputPath))
    : readLatestLearningSnapshot(workspace.repoRoot, hostName).snapshotPath;
  if (!snapshotSource) {
    console.error(`No learning snapshot found for host ${hostName}`);
    process.exit(1);
  }
  const snapshot = readLearningSnapshotBundle(snapshotSource);
  if (!snapshot) {
    console.error(`Unable to read learning snapshot: ${snapshotSource}`);
    process.exit(1);
  }
  const report = diffLearningSnapshot(workspace.repoRoot, snapshot);
  console.log(renderLearningSnapshotDiff(report));
}

function handleMemoryRollback(workspace, flags, positional) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const inputPath = flags.files?.[0] || positional[0];
  const snapshotSource = inputPath
    ? (path.isAbsolute(inputPath) ? inputPath : path.resolve(workspace.repoRoot, inputPath))
    : readLatestLearningSnapshot(workspace.repoRoot, hostName).snapshotPath;
  if (!snapshotSource) {
    console.error(`No learning snapshot found for host ${hostName}`);
    process.exit(1);
  }
  const snapshot = readLearningSnapshotBundle(snapshotSource);
  if (!snapshot) {
    console.error(`Unable to read learning snapshot: ${snapshotSource}`);
    process.exit(1);
  }
  const restored = restoreLearningSnapshot(workspace.repoRoot, snapshot);
  console.log(renderLearningSnapshotRestore({
    ...restored,
    snapshotPath: snapshotSource,
  }));
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
  const duplicateKeys = new Set();
  const candidateKeys = new Set();
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
    if (count > 1 && !duplicateKeys.has(key)) {
      duplicates.push(text);
      duplicateKeys.add(key);
    }
    if ((count > 1 || !hostSet.has(key) || isUniversalMemoryRule(text)) && !candidateKeys.has(key)) {
      candidates.push(text);
      candidateKeys.add(key);
    }
    if (text.length < 20 || /maybe|todo|temp|unclear/i.test(text)) {
      weak += 1;
    }
  }

  for (const entry of hostEntries) {
    const text = stripBulletPrefix(entry);
    if (!text) {
      continue;
    }
    if (isWeakMemoryRule(text)) {
      weak += 1;
    }
    if (hostEntries.filter((line) => normalizeMemoryBullet(line) === normalizeMemoryBullet(text)).length > 1 && !duplicateKeys.has(normalizeMemoryBullet(text))) {
      duplicates.push(text);
      duplicateKeys.add(normalizeMemoryBullet(text));
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
  const beforeBulletCount = readMemoryBullets(hostPath).length;
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
  return { targetPath: hostPath, added: Math.max(0, lines.filter((line) => line.trim().startsWith('- ')).length - beforeBulletCount) };
}

function gateHostMemory(repoRoot, hostName) {
  const normalizedHost = normalizeHostName(hostName);
  const review = reviewHostMemory(repoRoot, normalizedHost);
  const ready = review.candidates.length > 0 && review.weak === 0;
  return {
    ready,
    reason: ready ? 'host memory is compact and reusable' : 'host memory still has weak or uncompressed notes',
    review,
  };
}

function demoteHostMemory(repoRoot, hostName) {
  const normalizedHost = normalizeHostName(hostName);
  const hostPath = resolveHostMemoryPath(repoRoot, normalizedHost, 'host');
  const changePath = resolveHostMemoryPath(repoRoot, normalizedHost, 'change');
  ensureMemoryChangeFile(repoRoot, normalizedHost);
  const current = readOptionalText(hostPath);
  const lines = current.split(/\r?\n/);
  const next = [];
  const demoted = [];
  const seen = new Set();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) {
      next.push(line);
      continue;
    }

    const text = stripBulletPrefix(line);
    const key = normalizeMemoryBullet(text);
    if (!text) {
      continue;
    }
    if (isWeakMemoryRule(text) || seen.has(key)) {
      demoted.push(text);
      continue;
    }
    seen.add(key);
    next.push(line);
  }

  const preserved = next.filter((line) => line.trim().length > 0);
  if (preserved.length === 0) {
    preserved.push(`# ${humanize(normalizedHost)} Memory`);
    preserved.push('');
    preserved.push('- No durable lessons yet.');
  } else if (preserved.every((line) => !line.trim().startsWith('- '))) {
    preserved.push('');
    preserved.push('- No durable lessons yet.');
  }

  fs.writeFileSync(hostPath, `${preserved.join('\n').trimEnd()}\n`, 'utf8');
  for (const text of demoted) {
    appendMemoryEntry(changePath, `Demoted lesson: ${text}`);
  }
  return { demoted, targetPath: changePath, hostPath };
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

function resolveLearningRecoveryPaths(repoRoot, hostName) {
  const normalizedHost = normalizeHostName(hostName);
  const baseDir = path.join(repoRoot, 'docs', 'training', 'recovery', normalizedHost);
  return {
    baseDir,
    latestPath: path.join(baseDir, 'latest.json'),
    historyPath: path.join(baseDir, 'history.jsonl'),
    snapshotsDir: path.join(baseDir, 'snapshots'),
  };
}

function collectLearningSnapshotFiles(repoRoot, hostName, profileName) {
  const normalizedHost = normalizeHostName(hostName);
  const activeProfile = profileName || readCurrentProfileName(repoRoot);
  const files = {};
  const paths = [
    'AGENTS.md',
    path.join('profiles', activeProfile, 'AGENTS.md'),
    path.join('memory', 'profile', `${activeProfile}.md`),
    path.join('memory', 'host', `${normalizedHost}.md`),
    path.join('memory', 'change', `${normalizedHost}.md`),
    path.join('memory', 'packs', `${normalizedHost}.md`),
    path.join('docs', 'training', 'current.json'),
    path.join('docs', 'training', 'continuous.json'),
    path.join('docs', 'training', 'continuous.md'),
    path.join('docs', 'training', 'packs', `${normalizedHost}.md`),
    path.join('docs', 'training', 'packs', `${normalizedHost}.json`),
    path.join('docs', 'training', 'explain', `${normalizedHost}.jsonl`),
    path.join('docs', 'training', 'explain', `${normalizedHost}.md`),
    path.join('docs', 'training', 'compare', `${normalizedHost}.jsonl`),
    path.join('docs', 'training', 'compare', `${normalizedHost}.md`),
  ];

  for (const relative of paths) {
    const absolute = path.join(repoRoot, relative);
    files[relative] = fs.existsSync(absolute) ? serializeBackupEntry(absolute) : null;
  }

  return files;
}

function buildLearningSnapshot(repoRoot, hostName) {
  const normalizedHost = normalizeHostName(hostName);
  const activeProfile = readCurrentProfileName(repoRoot);
  const files = collectLearningSnapshotFiles(repoRoot, normalizedHost, activeProfile);
  const createdAt = new Date().toISOString();
  return {
    kind: 'agent-system-learning-snapshot',
    snapshotVersion: 1,
    packVersion: 1,
    createdAt,
    activeProfile,
    activeHost: normalizedHost,
    memoryIndex: memoryStats(repoRoot),
    files,
  };
}

function saveLearningSnapshot(repoRoot, hostName, source = 'manual') {
  const normalizedHost = normalizeHostName(hostName);
  const snapshot = buildLearningSnapshot(repoRoot, normalizedHost);
  const paths = resolveLearningRecoveryPaths(repoRoot, normalizedHost);
  const snapshotId = snapshot.createdAt.replace(/[:.]/g, '-');
  const archivePath = path.join(paths.snapshotsDir, `${snapshotId}.json`);
  fs.mkdirSync(paths.snapshotsDir, { recursive: true });
  fs.mkdirSync(path.dirname(paths.latestPath), { recursive: true });
  fs.writeFileSync(paths.latestPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  fs.writeFileSync(archivePath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  fs.appendFileSync(paths.historyPath, JSON.stringify({
    kind: 'agent-system-learning-snapshot-entry',
    activeProfile: snapshot.activeProfile,
    activeHost: snapshot.activeHost,
    createdAt: snapshot.createdAt,
    snapshotPath: path.relative(repoRoot, archivePath),
    latestPath: path.relative(repoRoot, paths.latestPath),
    packVersion: snapshot.packVersion,
    fileCount: Object.keys(snapshot.files).length,
    source,
  }) + '\n', 'utf8');
  try {
    captureBrainFromRecovery({
      repoRoot,
      activeProfileName: snapshot.activeProfile,
      activeHostName: normalizedHost,
      trainingRecoveryDir: path.dirname(path.dirname(paths.latestPath)),
      brainCurrentPath: path.join(repoRoot, 'docs', 'brain', 'current.json'),
      brainHistoryPath: path.join(repoRoot, 'docs', 'brain', 'history.jsonl'),
      activeProfile: { profile: snapshot.activeProfile },
      manifest: readJson(path.join(repoRoot, 'agent-system.json')),
      profileDocPath: path.join(repoRoot, 'profiles', snapshot.activeProfile, 'AGENTS.md'),
      manifestPath: path.join(repoRoot, 'agent-system.json'),
    }, {
      activeProfile: snapshot.activeProfile,
      activeHost: normalizedHost,
      fileCount: Object.keys(snapshot.files).length,
      latestPath: paths.latestPath,
      archivePath,
    }, source);
  } catch {
    // Brain capture should not block recovery snapshots.
  }
  return {
    snapshot,
    latestPath: paths.latestPath,
    archivePath,
    historyPath: paths.historyPath,
  };
}

function readLearningSnapshotBundle(snapshotPath) {
  if (!snapshotPath || !fs.existsSync(snapshotPath)) {
    return null;
  }
  try {
    return readJson(snapshotPath);
  } catch {
    return null;
  }
}

function readLatestLearningSnapshot(repoRoot, hostName) {
  const paths = resolveLearningRecoveryPaths(repoRoot, hostName);
  const latest = readLearningSnapshotBundle(paths.latestPath);
  if (latest) {
    return { snapshot: latest, snapshotPath: paths.latestPath };
  }
  if (!fs.existsSync(paths.historyPath)) {
    return { snapshot: null, snapshotPath: '' };
  }
  const lines = fs.readFileSync(paths.historyPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const last = lines.reverse().map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).find(Boolean);
  if (!last?.snapshotPath) {
    return { snapshot: null, snapshotPath: '' };
  }
  const resolved = path.isAbsolute(last.snapshotPath) ? last.snapshotPath : path.join(repoRoot, last.snapshotPath);
  return { snapshot: readLearningSnapshotBundle(resolved), snapshotPath: resolved };
}

function restoreLearningSnapshot(repoRoot, snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.files || typeof snapshot.files !== 'object') {
    throw new Error('learning snapshot missing files');
  }
  writeBackupEntries(repoRoot, snapshot.files);
  return {
    profileName: snapshot.activeProfile || readCurrentProfileName(repoRoot),
    activeHost: normalizeHostName(snapshot.activeHost || 'qwen'),
    fileCount: Object.keys(snapshot.files).length,
  };
}

function diffLearningSnapshot(repoRoot, snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.files || typeof snapshot.files !== 'object') {
    throw new Error('learning snapshot missing files');
  }
  const changed = [];
  for (const [relative, entry] of Object.entries(snapshot.files)) {
    const currentPath = path.join(repoRoot, relative);
    const currentText = fs.existsSync(currentPath) ? serializeBackupEntry(currentPath) : null;
    if (normalizeBackupEntryText(currentText) !== normalizeBackupEntryText(entry)) {
      changed.push(relative);
    }
  }
  return {
    snapshotVersion: snapshot.snapshotVersion || 1,
    activeProfile: snapshot.activeProfile || readCurrentProfileName(repoRoot),
    activeHost: normalizeHostName(snapshot.activeHost || 'qwen'),
    changed,
  };
}

function renderLearningSnapshotSnapshot(report) {
  const lines = [];
  lines.push('[LEARNING SNAPSHOT]');
  lines.push(`Host: ${report.activeHost}`);
  lines.push(`Profile: ${report.activeProfile}`);
  lines.push(`Files: ${report.fileCount}`);
  lines.push(`Snapshot: ${path.relative(process.cwd(), report.latestPath)}`);
  lines.push(`Archive: ${path.relative(process.cwd(), report.archivePath)}`);
  lines.push(`Pack version: ${report.packVersion}`);
  return lines.join('\n');
}

function renderLearningSnapshotRestore(report) {
  const lines = [];
  lines.push('[LEARNING RESTORE]');
  lines.push(`Host: ${report.activeHost}`);
  lines.push(`Profile: ${report.profileName}`);
  lines.push(`Restored: ${report.fileCount}`);
  lines.push(`Source: ${path.relative(process.cwd(), report.snapshotPath)}`);
  return lines.join('\n');
}

function createEmptyBrainState(workspace) {
  return {
    kind: 'agent-system-brain',
    brainVersion: 1,
    activeProfile: workspace.activeProfileName,
    activeHost: workspace.activeHostName,
    generatedAt: '',
    updatedAt: '',
    counts: {
      total: 0,
      active: 0,
      candidate: 0,
      demoted: 0,
      archived: 0,
      byScope: {},
      bySource: {},
    },
    entries: [],
  };
}

function readBrainCurrent(workspace) {
  if (!fs.existsSync(workspace.brainCurrentPath)) {
    return createEmptyBrainState(workspace);
  }
  try {
    const current = readJson(workspace.brainCurrentPath);
    return materializeBrainStateFromEntries(workspace, current.entries || []);
  } catch {
    return createEmptyBrainState(workspace);
  }
}

function readBrainHistory(workspace) {
  if (!fs.existsSync(workspace.brainHistoryPath)) {
    return [];
  }
  const entries = [];
  const lines = fs.readFileSync(workspace.brainHistoryPath, 'utf8').split(/\r?\n/);
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

function writeBrainCurrent(workspace, current) {
  fs.mkdirSync(path.dirname(workspace.brainCurrentPath), { recursive: true });
  fs.writeFileSync(workspace.brainCurrentPath, JSON.stringify(current, null, 2) + '\n', 'utf8');
  return current;
}

function materializeBrainStateFromEntries(workspace, entries) {
  const normalizedEntries = Array.isArray(entries)
    ? entries
        .map((entry) => normalizeBrainEntry(entry, workspace))
        .filter(Boolean)
    : [];
  normalizedEntries.sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')));
  return buildBrainState(workspace, normalizedEntries);
}

function materializeBrainCurrent(workspace) {
  const history = readBrainHistory(workspace);
  if (history.length === 0) {
    const current = readBrainCurrent(workspace);
    return current.entries.length > 0 ? buildBrainState(workspace, current.entries) : current;
  }
  const entries = new Map();
  for (const event of history) {
    const normalized = normalizeBrainEntry(event, workspace);
    if (!normalized) continue;
    const existing = entries.get(normalized.brainId);
    entries.set(normalized.brainId, existing ? mergeBrainEntries(existing, normalized) : normalized);
  }
  return buildBrainState(workspace, Array.from(entries.values()));
}

function buildBrainState(workspace, entries, generatedAt = new Date().toISOString()) {
  return {
    kind: 'agent-system-brain',
    brainVersion: 1,
    activeProfile: workspace.activeProfileName,
    activeHost: workspace.activeHostName,
    generatedAt,
    updatedAt: generatedAt,
    counts: buildBrainCounts(entries),
    entries,
  };
}

function buildBrainCounts(entries) {
  const counts = {
    total: 0,
    active: 0,
    candidate: 0,
    demoted: 0,
    archived: 0,
    byScope: {},
    bySource: {},
  };
  for (const entry of entries || []) {
    if (!entry) continue;
    counts.total += 1;
    const status = normalizeBrainStatus(entry.status);
    counts[status] = (counts[status] || 0) + 1;
    const scope = normalizeBrainScope(entry.scope || 'system');
    counts.byScope[scope] = (counts.byScope[scope] || 0) + 1;
    const source = String(entry.source || 'manual').trim().toLowerCase() || 'manual';
    counts.bySource[source] = (counts.bySource[source] || 0) + 1;
  }
  return counts;
}

function normalizeBrainScope(value) {
  const text = String(value || 'system').trim().toLowerCase();
  if (!text) return 'system';
  if (text.startsWith('host:') || text.startsWith('profile:') || text.startsWith('task:')) {
    return text;
  }
  if (['system', 'profile', 'host', 'change', 'training', 'eval', 'luau', 'recovery', 'upgrade', 'memory'].includes(text)) {
    return text;
  }
  return text.replace(/[^a-z0-9:-]+/g, '-');
}

function normalizeBrainStatus(value) {
  const text = String(value || 'candidate').trim().toLowerCase();
  if (text === 'active' || text === 'promoted' || text === 'ready') return 'active';
  if (text === 'demoted' || text === 'blocked') return 'demoted';
  if (text === 'archived' || text === 'pruned') return 'archived';
  return 'candidate';
}

function brainEntryId(title, scope, source) {
  return `brain:${slugifyText(source || 'manual')}:${slugifyText(scope || 'system')}:${slugifyText(title || 'lesson')}`;
}

function slugifyText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'entry';
}

function normalizeBrainEntry(entry, workspace) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const title = String(entry.title || entry.name || entry.summary || 'Brain lesson').trim();
  const summary = String(entry.summary || title).trim();
  const source = String(entry.source || entry.eventType || 'manual').trim().toLowerCase() || 'manual';
  const scope = normalizeBrainScope(entry.scope || 'system');
  const status = normalizeBrainStatus(entry.status || 'candidate');
  const confidence = Math.max(0, Math.min(100, parseCount(entry.confidence, 70)));
  const brainId = String(entry.brainId || brainEntryId(title, scope, source)).trim();
  const host = normalizeHostName(entry.host || workspace.activeHostName);
  const profile = String(entry.profile || workspace.activeProfileName || 'imphub').trim();
  const createdAt = String(entry.createdAt || entry.recordedAt || '').trim() || null;
  const updatedAt = String(entry.updatedAt || entry.recordedAt || entry.createdAt || '').trim() || createdAt || new Date().toISOString();
  const eventCount = Math.max(1, parseCount(entry.eventCount, 1));
  return {
    brainId,
    source,
    scope,
    status,
    confidence,
    title,
    summary,
    facts: normalizeChangeList(entry.facts || entry.fact || []),
    tags: normalizeChangeList(entry.tags || entry.tag || []),
    relatedPaths: normalizeChangeList(entry.relatedPaths || entry.paths || []),
    evidence: String(entry.evidence || '').trim(),
    host,
    profile,
    createdAt,
    updatedAt,
    eventCount,
    lastEvent: String(entry.lastEvent || source).trim() || source,
  };
}

function mergeBrainEntries(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    createdAt: existing.createdAt || incoming.createdAt,
    updatedAt: incoming.updatedAt,
    eventCount: Math.max(1, parseCount(existing.eventCount, 1) + 1),
    confidence: Math.max(existing.confidence || 0, incoming.confidence || 0),
    facts: mergeUniqueStrings(existing.facts, incoming.facts),
    tags: mergeUniqueStrings(existing.tags, incoming.tags),
    relatedPaths: mergeUniqueStrings(existing.relatedPaths, incoming.relatedPaths),
    lastEvent: incoming.lastEvent || incoming.source,
  };
}

function mergeUniqueStrings(left, right) {
  return Array.from(new Set([...(Array.isArray(left) ? left : normalizeChangeList(left)), ...(Array.isArray(right) ? right : normalizeChangeList(right))].filter(Boolean)));
}

function appendBrainEvent(workspace, entry) {
  const current = materializeBrainCurrent(workspace);
  const normalized = normalizeBrainEntry(entry, workspace);
  if (!normalized) {
    throw new Error('brain entry missing content');
  }
  const existing = current.entries.find((item) => item.brainId === normalized.brainId);
  const merged = existing ? mergeBrainEntries(existing, normalized) : { ...normalized, eventCount: 1 };
  const entries = current.entries.filter((item) => item.brainId !== merged.brainId);
  entries.unshift(merged);
  const next = buildBrainState(workspace, entries);
  writeBrainCurrent(workspace, next);

  const history = readBrainHistory(workspace);
  const historyEntry = {
    kind: 'agent-system-brain-event',
    brainVersion: 1,
    ...merged,
    eventType: normalized.source,
    recordedAt: normalized.updatedAt,
    sequence: history.length + 1,
  };
  fs.mkdirSync(path.dirname(workspace.brainHistoryPath), { recursive: true });
  fs.appendFileSync(workspace.brainHistoryPath, JSON.stringify(historyEntry) + '\n', 'utf8');
  return merged;
}

function brainScopeMatches(entryScope, requestedScope) {
  const entryText = normalizeBrainScope(entryScope || 'system');
  const requestText = normalizeBrainScope(requestedScope || 'all');
  if (requestText === 'all') {
    return true;
  }
  if (entryText === requestText) {
    return true;
  }
  return entryText.includes(requestText) || requestText.includes(entryText);
}

function scoreBrainEntry(entry, normalizedQuery, queryTokens, explain, reasons) {
  if (!normalizedQuery && (!queryTokens || queryTokens.length === 0)) {
    if (explain) reasons.push('list current entry');
    return 1;
  }
  let score = 0;
  const haystacks = [
    ['title', entry.title],
    ['summary', entry.summary],
    ['source', entry.source],
    ['scope', entry.scope],
    ['status', entry.status],
    ['evidence', entry.evidence],
    ['facts', Array.isArray(entry.facts) ? entry.facts.join(' ') : entry.facts],
    ['tags', Array.isArray(entry.tags) ? entry.tags.join(' ') : entry.tags],
    ['paths', Array.isArray(entry.relatedPaths) ? entry.relatedPaths.join(' ') : entry.relatedPaths],
    ['brainId', entry.brainId],
  ];
  for (const [label, value] of haystacks) {
    const text = normalize(value);
    if (!text) continue;
    if (normalizedQuery && text.includes(normalizedQuery)) {
      score += 20;
      if (explain) reasons.push(`matched ${label}`);
    }
    for (const token of queryTokens || []) {
      if (token && text.includes(token)) {
        score += 4;
        if (explain && !reasons.includes(`token ${token}`)) {
          reasons.push(`token ${token}`);
        }
      }
    }
  }
  return score;
}

function queryBrainEntries(workspace, query, opts = {}) {
  const current = materializeBrainCurrent(workspace);
  const scopeFilter = normalizeBrainScope(opts.scope || 'all');
  const normalizedQuery = normalize(query);
  const queryTokens = normalizedQuery ? normalizedQuery.split(' ').filter(Boolean) : [];
  const results = [];
  for (const entry of current.entries) {
    if (scopeFilter !== 'all' && scopeFilter && !brainScopeMatches(entry.scope, scopeFilter)) {
      continue;
    }
    const reasons = [];
    const score = scoreBrainEntry(entry, normalizedQuery, queryTokens, opts.explain, reasons);
    if (!normalizedQuery && !opts.list) {
      results.push({ ...entry, score, reasons });
      continue;
    }
    if (score > 0 || opts.list) {
      results.push({ ...entry, score, reasons });
    }
  }
  results.sort((left, right) => {
    if ((right.score || 0) !== (left.score || 0)) {
      return (right.score || 0) - (left.score || 0);
    }
    return String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || ''));
  });
  return { matches: results };
}

function pruneBrainHistory(workspace) {
  const history = readBrainHistory(workspace);
  const seen = new Set();
  const prunedHistory = [];
  let pruned = 0;
  for (const event of history) {
    const normalized = normalizeBrainEntry(event, workspace);
    if (!normalized) {
      pruned += 1;
      continue;
    }
    const key = [
      normalized.brainId,
      normalized.status,
      normalizeNewlines(normalized.summary),
      normalizeNewlines(normalized.evidence),
      normalized.source,
    ].join('|');
    if (seen.has(key)) {
      pruned += 1;
      continue;
    }
    seen.add(key);
    prunedHistory.push({
      kind: 'agent-system-brain-event',
      brainVersion: 1,
      ...normalized,
      eventType: normalized.source,
      recordedAt: event.recordedAt || normalized.updatedAt,
      sequence: prunedHistory.length + 1,
    });
  }
  fs.mkdirSync(path.dirname(workspace.brainHistoryPath), { recursive: true });
  fs.writeFileSync(workspace.brainHistoryPath, prunedHistory.map((entry) => JSON.stringify(entry)).join('\n') + (prunedHistory.length > 0 ? '\n' : ''), 'utf8');
  const materialized = materializeBrainCurrent(workspace);
  writeBrainCurrent(workspace, materialized);
  return {
    pruned,
    notes: pruned > 0 ? ['rewrote brain history', 'refreshed current brain state'] : ['no duplicate events found'],
  };
}

function buildBrainSnapshot(workspace) {
  const current = materializeBrainCurrent(workspace);
  const history = readBrainHistory(workspace);
  return {
    kind: 'agent-system-brain-snapshot',
    brainVersion: 1,
    createdAt: new Date().toISOString(),
    activeProfile: current.activeProfile,
    activeHost: current.activeHost,
    counts: current.counts,
    current,
    history,
  };
}

function restoreBrainSnapshot(workspace, snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('brain snapshot must be an object');
  }
  const currentEntries = snapshot.current && Array.isArray(snapshot.current.entries)
    ? snapshot.current.entries
    : Array.isArray(snapshot.entries)
      ? snapshot.entries
      : Array.isArray(snapshot.history)
        ? snapshot.history
        : [];
  const current = materializeBrainStateFromEntries(workspace, currentEntries);
  const history = Array.isArray(snapshot.history)
    ? snapshot.history
    : current.entries.map((entry, index) => ({
        kind: 'agent-system-brain-event',
        brainVersion: 1,
        ...entry,
        eventType: entry.source || 'snapshot',
        recordedAt: entry.updatedAt || current.updatedAt || new Date().toISOString(),
        sequence: index + 1,
      }));
  writeBrainCurrent(workspace, current);
  fs.mkdirSync(path.dirname(workspace.brainHistoryPath), { recursive: true });
  fs.writeFileSync(workspace.brainHistoryPath, history.map((entry, index) => JSON.stringify({ ...entry, sequence: entry.sequence || index + 1 })).join('\n') + (history.length > 0 ? '\n' : ''), 'utf8');
  const restored = readBrainCurrent(workspace);
  return {
    activeProfile: restored.activeProfile,
    activeHost: restored.activeHost,
    entries: restored.entries.length,
  };
}

function diffBrainSnapshot(workspace, snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('brain snapshot must be an object');
  }
  const current = materializeBrainCurrent(workspace);
  const snapshotCurrent = snapshot.current && typeof snapshot.current === 'object'
    ? materializeBrainStateFromEntries(workspace, snapshot.current.entries || [])
    : materializeBrainStateFromEntries(workspace, Array.isArray(snapshot.entries) ? snapshot.entries : Array.isArray(snapshot.history) ? snapshot.history : []);
  const currentMap = new Map(current.entries.map((entry) => [entry.brainId, entry]));
  const snapshotMap = new Map((snapshotCurrent.entries || []).map((entry) => [entry.brainId, entry]));
  const changed = [];
  for (const [brainId, entry] of snapshotMap.entries()) {
    const currentEntry = currentMap.get(brainId);
    if (!currentEntry) {
      changed.push(`missing in current: ${brainId}`);
      continue;
    }
    if (normalizeNewlines(JSON.stringify(currentEntry)) !== normalizeNewlines(JSON.stringify(entry))) {
      changed.push(`different: ${brainId}`);
    }
  }
  for (const brainId of currentMap.keys()) {
    if (!snapshotMap.has(brainId)) {
      changed.push(`new in current: ${brainId}`);
    }
  }
  return {
    activeProfile: current.activeProfile,
    activeHost: current.activeHost,
    changed,
  };
}

function captureBrainFromChange(workspace, intake, eventType) {
  if (!intake) return;
  const target = intake.target || intake.name || 'change';
  const title = `${humanizeChangeType(intake.type || eventType || 'update')} ${target}`;
  const ready = Boolean(intake.ready);
  appendBrainEvent(workspace, {
    source: eventType || 'change',
    scope: `profile:${workspace.activeProfileName}`,
    status: ready ? 'active' : 'candidate',
    confidence: ready ? 80 : 60,
    title,
    summary: `${humanizeChangeType(intake.type || 'update')} gate for ${target} using ${intake.routeSelected || 'route'}${ready ? ' is ready.' : ' still needs proof.'}`,
    facts: [
      `type: ${intake.type || 'update'}`,
      `target: ${target}`,
      `route: ${intake.routeSelected || 'n/a'}`,
      `baseline: ${intake.baselineFile || 'n/a'}`,
      `regression: ${intake.regressionMatrix || 'n/a'}`,
    ],
    tags: normalizeChangeList(intake.classification || []).concat(normalizeChangeList(intake.ownedDomains || []), [intake.type || 'update']).filter(Boolean),
    relatedPaths: normalizeChangeList([
      intake.target || '',
      intake.baselineFile || '',
      intake.regressionMatrix || '',
      intake.oldNewMapping || '',
    ]),
    evidence: ready ? 'change gate ready' : `change gate blocked: ${formatList(intake.stopLineRisks || [])}`,
    host: workspace.activeHostName,
    profile: workspace.activeProfileName,
  });
}

function captureBrainFromTraining(workspace, report) {
  appendBrainEvent(workspace, {
    source: `train-${report.mode}`,
    scope: `host:${normalizeHostName(report.activeHost)}`,
    status: report.outcome === 'held' ? 'candidate' : 'active',
    confidence: report.outcome === 'held' ? 65 : 82,
    title: `${humanize(report.activeHost)} training ${report.mode}`,
    summary: `${report.mode} training on ${report.focus || 'general'} ended with ${report.outcome}.`,
    facts: [
      `focus: ${report.focus || 'general'}`,
      `language: ${report.language || 'general'}`,
      `lesson: ${report.lesson || report.luauLesson || 'none'}`,
    ],
    tags: ['train', report.focus || 'general', report.language || 'general'].concat(report.luauLesson ? ['luau'] : []),
    relatedPaths: [report.summaryPath, workspace.trainingCurrentPath, workspace.trainingHistoryPath],
    evidence: report.lesson || report.luauLesson || report.outcome,
    host: report.activeHost,
    profile: report.activeProfile,
  });
}

function captureBrainFromEvaluation(workspace, report) {
  appendBrainEvent(workspace, {
    source: `eval-${report.mode}`,
    scope: `host:${normalizeHostName(report.activeHost)}`,
    status: report.promoted ? 'active' : 'candidate',
    confidence: report.promoted ? 85 : Math.max(45, Math.min(80, report.score || 50)),
    title: `${humanize(report.activeHost)} evaluation ${report.mode}`,
    summary: `Evaluation score ${report.score} with verdict ${report.verdict} for ${report.focus || 'general'}.`,
    facts: [
      `threshold: ${report.threshold}`,
      `score: ${report.score}`,
      `delta: ${report.delta}`,
      `verdict: ${report.verdict}`,
    ],
    tags: ['eval', report.mode, report.focus || 'general'].concat(report.luauLesson ? ['luau'] : []),
    relatedPaths: [report.summaryPath, workspace.evalCurrentPath, workspace.evalHistoryPath],
    evidence: report.luauLesson || report.verdict,
    host: report.activeHost,
    profile: report.activeProfile,
  });
}

function captureBrainFromUpgrade(workspace, report) {
  appendBrainEvent(workspace, {
    source: 'upgrade',
    scope: `profile:${workspace.activeProfileName}`,
    status: 'active',
    confidence: 78,
    title: `${workspace.activeProfileName} upgrade sync`,
    summary: `Upgrade sync touched ${report.agents.length} agent sections across ${report.hosts.length} host views.`,
    facts: [
      `agents: ${report.agents.map((agent) => agent.title).join(', ') || 'none'}`,
      `hosts: ${report.hosts.join(', ') || 'none'}`,
    ],
    tags: ['upgrade', workspace.activeProfileName].concat(report.hosts || []),
    relatedPaths: [workspace.profileDocPath, path.join(workspace.repoRoot, 'AGENTS.md'), workspace.manifestPath],
    evidence: `Upgrade sync for ${workspace.activeProfileName}`,
    host: workspace.activeHostName,
    profile: workspace.activeProfileName,
  });
}

function captureBrainFromRecovery(workspace, report, source = 'recovery') {
  appendBrainEvent(workspace, {
    source,
    scope: `host:${normalizeHostName(report.activeHost || workspace.activeHostName)}`,
    status: 'active',
    confidence: 88,
    title: `${humanize(report.activeHost || workspace.activeHostName)} recovery snapshot`,
    summary: `Captured ${report.fileCount} learning files for rollback and restore.`,
    facts: [
      `profile: ${report.activeProfile || workspace.activeProfileName}`,
      `host: ${report.activeHost || workspace.activeHostName}`,
      `files: ${report.fileCount}`,
    ],
    tags: ['recovery', 'snapshot', report.activeHost || workspace.activeHostName],
    relatedPaths: [report.latestPath, report.archivePath, workspace.trainingRecoveryDir],
    evidence: `Recovery snapshot from ${source}`,
    host: report.activeHost || workspace.activeHostName,
    profile: report.activeProfile || workspace.activeProfileName,
  });
}

function captureBrainFromMemory(workspace, hostName, action, detail, ready = true) {
  appendBrainEvent(workspace, {
    source: `memory-${action}`,
    scope: `host:${normalizeHostName(hostName || workspace.activeHostName)}`,
    status: ready ? 'active' : 'candidate',
    confidence: ready ? 74 : 58,
    title: `${humanize(hostName || workspace.activeHostName)} memory ${action}`,
    summary: detail || `Memory action ${action} on ${hostName || workspace.activeHostName}.`,
    facts: [detail || `action: ${action}`],
    tags: ['memory', action],
    relatedPaths: [
      resolveHostMemoryPath(workspace.repoRoot, hostName || workspace.activeHostName, 'host'),
      resolveHostMemoryPath(workspace.repoRoot, hostName || workspace.activeHostName, 'change'),
      resolveHostMemoryPath(workspace.repoRoot, hostName || workspace.activeHostName, 'packs'),
    ],
    evidence: detail || action,
    host: hostName || workspace.activeHostName,
    profile: workspace.activeProfileName,
  });
}

function renderLearningSnapshotDiff(report) {
  const lines = [];
  lines.push('[LEARNING DIFF]');
  lines.push(`Host: ${report.activeHost}`);
  lines.push(`Profile: ${report.activeProfile}`);
  lines.push(`Changed: ${report.changed.length}`);
  for (const item of report.changed) {
    lines.push(`- ${item}`);
  }
  return lines.join('\n');
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

function handleQuickUpdate(workspace, flags, positional) {
  const current = readChangeCurrent(workspace);
  const target = flags.target || positional[0] || current.target || '';
  const intent = flags.intent || (flags.target ? positional.join(' ') : positional.slice(1).join(' ')) || current.intent || '';
  if (!isFilled(target) || !isFilled(intent)) {
    console.error('Usage: agent-system quick-update <target> <intent>');
    process.exit(1);
  }

  const intake = buildChangeIntake(
    workspace,
    {
      ...flags,
      type: flags.type || 'update',
      target,
      intent,
      name: flags.name || current.name || inferChangeName(target, workspace.activeProfileName),
    },
    current,
    false,
  );
  const scaffoldedIntake = {
    ...intake,
    scaffoldedAt: intake.scaffoldedAt || new Date().toISOString(),
  };
  scaffoldChangeWorkspace(workspace, scaffoldedIntake);
  writeChangeRecord(workspace, scaffoldedIntake, 'quick-update');

  const report = evaluateChangeGate(scaffoldedIntake);
  console.log('[QUICK UPDATE]');
  console.log(renderChangeTaskLock(scaffoldedIntake));
  console.log(renderChangePreview(scaffoldedIntake, report));
  console.log(`Gate status: ${report.ready ? 'Ready' : 'Blocked'}`);
}

function detectQuickFixCandidate(repoRoot) {
  const status = collectGitStatus(repoRoot);
  if (status.length !== 1) {
    return null;
  }
  const entry = status[0];
  if (!isQuickFixFile(entry.file)) {
    return null;
  }
  return {
    target: entry.file,
    agent: inferQuickFixAgent(entry.file),
    skill: inferQuickFixSkill(entry.file),
    checks: ['target changed', 'single file', 'code/config only'],
    reason: `single code/config file touched: ${entry.file}`,
    risk: 'Low - single file, no cross-file state',
    change: inferQuickFixChange(entry.file),
    scope: inferQuickFixScope(entry.file),
  };
}

function detectLuauQuickCandidate(repoRoot) {
  const candidate = detectQuickFixCandidate(repoRoot);
  if (!candidate || !isLuauQuickFile(candidate.target)) {
    return null;
  }
  return {
    ...candidate,
    agent: 'Scriptmaster',
    checks: ['target changed', 'single file', 'Luau only', 'code/config only'],
    reason: `single Luau file touched: ${candidate.target}`,
    risk: 'Low - single Luau file, no cross-file state',
    change: `Tune Luau behavior in ${candidate.target}`,
    scope: 'logic',
    memoryLine: `Luau lesson: ${candidate.change}; target: ${candidate.target}; scope: ${candidate.scope}.`,
    language: 'Luau',
    luauQuick: true,
  };
}

function buildQuickFixReport(workspace, candidate, hostName, options = {}) {
  const now = new Date().toISOString();
  const memoryPath = resolveHostMemoryPath(workspace.repoRoot, hostName, 'change');
  const memoryLine = options.memoryLine || `Quick fix lesson: ${candidate.change}; target: ${candidate.target}; scope: ${candidate.scope}.`;
  return {
    kind: options.kind || 'agent-system-quick-fix',
    version: 1,
    activeProfile: workspace.activeProfileName,
    activeHost: hostName,
    generatedAt: now,
    target: candidate.target,
    agent: options.agent || candidate.agent,
    skill: options.skill || candidate.skill,
    checks: options.checks || candidate.checks,
    reason: options.reason || candidate.reason,
    risk: options.risk || candidate.risk,
    change: options.change || candidate.change,
    scope: options.scope || candidate.scope,
    language: options.language || candidate.language || (isLuauQuickFile(candidate.target) ? 'Luau' : 'code/config'),
    targetChanged: true,
    noSideEffects: true,
    codeConfigOnly: true,
    ready: true,
    memoryPath,
    memoryLine,
    luauQuick: Boolean(options.luauQuick || candidate.luauQuick),
  };
}

function writeQuickFixRecord(workspace, report) {
  const current = {
    kind: report.kind,
    version: report.version,
    type: 'quick-fix',
    name: path.basename(report.target).replace(/\.[^.]+$/, ''),
    target: report.target,
    intent: report.change,
    processSkill: 'quick-fix',
    routeSelected: 'quick-fix',
    classification: [report.scope],
    ownedDomains: [report.scope],
    baselineFile: 'n/a',
    regressionMatrix: 'n/a',
    oldNewMapping: 'n/a',
    stopLineRisks: [],
    sourceFiles: [report.target],
    ready: report.ready,
    state: report.ready ? 'ready' : 'blocked',
    createdAt: report.generatedAt,
    scoutedAt: report.generatedAt,
    scaffoldedAt: report.generatedAt,
    updatedAt: report.generatedAt,
    gatedAt: report.generatedAt,
    profile: workspace.activeProfileName,
    host: report.activeHost,
    quickFix: true,
    luauQuick: Boolean(report.luauQuick),
    language: report.language || null,
    agent: report.agent,
    skill: report.skill,
  };
  scaffoldChangeWorkspace(workspace, current);
  writeChangeRecord(workspace, current, 'quick-fix');
}

function captureQuickFixMemory(workspace, report) {
  ensureMemoryChangeFile(workspace.repoRoot, report.activeHost);
  appendMemoryEntry(report.memoryPath, report.memoryLine);
}

function isLuauQuickFile(file) {
  const text = String(file || '').toLowerCase();
  return text.endsWith('.lua') || text.endsWith('.luau');
}

function isQuickFixFile(file) {
  const text = String(file || '').toLowerCase();
  if (!text) return false;
  if (text.startsWith('docs/') || text.startsWith('memory/') || text.startsWith('change/') || text.startsWith('status/')) {
    return false;
  }
  const base = path.posix.basename(text);
  const configNames = new Set([
    'package.json',
    'agent-system.json',
    '.gitignore',
    'tsconfig.json',
    'jsconfig.json',
    'eslint.config.js',
    'eslint.config.mjs',
    'prettier.config.js',
    'prettier.config.mjs',
    'vite.config.js',
    'vitest.config.js',
    'rollup.config.js',
  ]);
  if (configNames.has(base)) return true;
  return /\.(mjs|js|cjs|ts|tsx|lua|luau|py|rb|go|rs|c|cc|cpp|h|hpp|json|yml|yaml|toml|ini|env)$/i.test(base);
}

function inferQuickFixAgent(file) {
  const lower = String(file || '').toLowerCase();
  if (lower.includes('package.json') || lower.includes('config') || lower.endsWith('.json')) {
    return 'Config Keeper';
  }
  if (lower.includes('bin/') || lower.endsWith('.mjs') || lower.endsWith('.js') || lower.endsWith('.ts')) {
    return 'Scriptmaster';
  }
  return 'Update Steward';
}

function inferQuickFixSkill(file) {
  const lower = String(file || '').toLowerCase();
  if (lower.includes('package.json') || lower.endsWith('.json') || lower.includes('config')) {
    return 'config-persistence-migration';
  }
  return 'existing-script-feature-injection';
}

function inferQuickFixChange(file) {
  const base = path.posix.basename(String(file || 'quick-fix'));
  if (base === 'package.json' || base.endsWith('.json')) {
    return `Adjust config in ${file}`;
  }
  return `Tighten single-file behavior in ${file}`;
}

function inferQuickFixScope(file) {
  const lower = String(file || '').toLowerCase();
  if (lower.includes('package.json') || lower.endsWith('.json') || lower.includes('config')) {
    return 'config';
  }
  return 'logic';
}

function handleQuickFix(workspace, flags, positional) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const candidate = detectQuickFixCandidate(workspace.repoRoot);
  if (!candidate) {
    console.error('Usage: agent-system quick-fix (one code/config file must be changed)');
    process.exit(1);
  }

  const report = buildQuickFixReport(workspace, candidate, hostName);
  writeQuickFixRecord(workspace, report);
  captureQuickFixMemory(workspace, report);

  console.log('[QUICK LOCK]');
  console.log(`Target: ${report.target}`);
  console.log(`Change: ${report.change}`);
  console.log(`Risk: ${report.risk}`);
  console.log('[QUICK ROUTE]');
  console.log(`Type: quick-fix`);
  console.log(`Agent: ${report.agent}`);
  console.log(`Skill: ${report.skill}`);
  console.log(`Checks: ${report.checks.join(', ')}`);
  console.log('[QUICK GATE]');
  console.log(`Target changed: ${report.targetChanged ? 'yes' : 'no'}`);
  console.log(`No side effects: ${report.noSideEffects ? 'yes' : 'no'}`);
  console.log(`Code/config only: ${report.codeConfigOnly ? 'yes' : 'no'}`);
  console.log(`Ready: ${report.ready ? 'yes' : 'no'}`);
  console.log('[QUICK MEMORY]');
  console.log(`Where: ${path.relative(workspace.repoRoot, report.memoryPath)}`);
  console.log(`What: ${report.memoryLine}`);
  console.log(`Scope: ${report.scope}`);

  if (!report.ready) {
    process.exit(1);
  }
}

function handleLuauQuick(workspace, flags, positional) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const candidate = detectLuauQuickCandidate(workspace.repoRoot);
  if (!candidate) {
    console.error('Usage: agent-system luau-quick (one Luau file must be changed)');
    process.exit(1);
  }

  const report = buildQuickFixReport(workspace, candidate, hostName, {
    kind: 'agent-system-luau-quick',
    memoryLine: candidate.memoryLine,
    language: 'Luau',
    luauQuick: true,
    checks: candidate.checks,
    reason: candidate.reason,
    risk: candidate.risk,
    change: candidate.change,
    scope: candidate.scope,
    agent: candidate.agent,
    skill: candidate.skill,
  });
  writeQuickFixRecord(workspace, report);
  captureQuickFixMemory(workspace, report);

  console.log('[LUAU QUICK]');
  console.log(`Luau target: ${report.target}`);
  console.log(`Host: ${report.activeHost}`);
  console.log(`Language: ${report.language}`);
  console.log('[QUICK LOCK]');
  console.log(`Target: ${report.target}`);
  console.log(`Change: ${report.change}`);
  console.log(`Risk: ${report.risk}`);
  console.log('[QUICK ROUTE]');
  console.log(`Type: quick-fix`);
  console.log(`Agent: ${report.agent}`);
  console.log(`Skill: ${report.skill}`);
  console.log(`Checks: ${report.checks.join(', ')}`);
  console.log(`Language: ${report.language}`);
  console.log('[QUICK GATE]');
  console.log(`Target changed: ${report.targetChanged ? 'yes' : 'no'}`);
  console.log(`No side effects: ${report.noSideEffects ? 'yes' : 'no'}`);
  console.log(`Code/config only: ${report.codeConfigOnly ? 'yes' : 'no'}`);
  console.log(`Ready: ${report.ready ? 'yes' : 'no'}`);
  console.log('[QUICK MEMORY]');
  console.log(`Where: ${path.relative(workspace.repoRoot, report.memoryPath)}`);
  console.log(`What: ${report.memoryLine}`);
  console.log(`Scope: ${report.scope}`);

  if (!report.ready) {
    process.exit(1);
  }
}

function isLuauRepairFile(file) {
  const text = String(file || '').toLowerCase();
  if (!text) return false;
  if (text.startsWith('docs/') || text.startsWith('memory/') || text.startsWith('change/') || text.startsWith('status/')) {
    return false;
  }
  const base = path.posix.basename(text);
  if (base === 'agents.md') return true;
  if (text.startsWith('docs/luau/')) return true;
  if (base === 'package.json' || base.endsWith('.json')) return true;
  return text.endsWith('.lua') || text.endsWith('.luau');
}

function detectLuauRepairCandidate(repoRoot) {
  const status = collectGitStatus(repoRoot);
  const files = status.map((entry) => entry.file).filter(isLuauRepairFile);
  if (files.length < 2) {
    return null;
  }
  const luauFiles = files.filter((file) => file.endsWith('.lua') || file.endsWith('.luau'));
  const configFiles = files.filter((file) => file.endsWith('.json'));
  const repairDocs = files.filter((file) => file === 'AGENTS.md' || file.startsWith('docs/luau/'));
  const risk = files.length > 3 ? 'High - multi-file Luau repair' : 'Medium - multi-file Luau repair';
  return {
    files,
    luauFiles,
    configFiles,
    repairDocs,
    selectedPath: 'luau-repair',
    risk,
    proof: 'multi-file repair, memory sync, docs sync, AGENTS sync, luau gate',
  };
}

function readLuauRepairCurrent(workspace) {
  const currentPath = path.join(workspace.repoRoot, 'docs', 'luau', 'current.json');
  if (!fs.existsSync(currentPath)) {
    return {
      ready: false,
      selectedPath: 'luau-repair',
      files: [],
      issues: [],
      proof: 'repair state not captured yet',
    };
  }
  try {
    return readJson(currentPath);
  } catch {
    return {
      ready: false,
      selectedPath: 'luau-repair',
      files: [],
      issues: [],
      proof: 'repair state unreadable',
    };
  }
}

function buildLuauDiagnosis(workspace, hostName) {
  const candidate = detectLuauRepairCandidate(workspace.repoRoot);
  if (!candidate) {
    return {
      active: false,
      activeHost: hostName,
      selectedPath: 'quick-fix',
      risk: 'Low - no multi-file Luau repair needed',
      issues: [],
      files: [],
      proof: 'single-file or non-Luau change',
    };
  }

  const issues = [];
  if (candidate.luauFiles.length > 0) {
    issues.push('Luau source files changed');
  }
  if (candidate.configFiles.length > 0) {
    issues.push('config touched');
  }
  if (candidate.repairDocs.length > 0) {
    issues.push('teaching or contract drift detected');
  }
  if (candidate.files.length > 3) {
    issues.push('multi-file repair needed');
  }

  return {
    active: true,
    activeHost: hostName,
    selectedPath: candidate.selectedPath,
    risk: candidate.risk,
    issues,
    files: candidate.files,
    proof: candidate.proof,
  };
}

function handleLuauExplain(workspace, flags, positional) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const diagnosis = buildLuauDiagnosis(workspace, hostName);
  console.log('[LUAU EXPLAIN]');
  console.log(`Host: ${hostName}`);
  console.log(`Selected path: ${diagnosis.selectedPath}`);
  console.log(`Risk: ${diagnosis.risk}`);
  console.log(`Proof: ${diagnosis.proof}`);
  if (diagnosis.issues.length > 0) {
    console.log('Issues:');
    for (const issue of diagnosis.issues) {
      console.log(`- ${issue}`);
    }
  }
}

function handleLuauDiagnose(workspace, flags, positional) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const diagnosis = buildLuauDiagnosis(workspace, hostName);
  console.log('[LUAU DIAGNOSE]');
  console.log(`Host: ${hostName}`);
  console.log(`Selected path: ${diagnosis.selectedPath}`);
  console.log(`Risk: ${diagnosis.risk}`);
  console.log('Issues:');
  for (const issue of diagnosis.issues) {
    console.log(`- ${issue}`);
  }
}

function applyLuauRepair(workspace, diagnosis, hostName) {
  const now = new Date().toISOString();
  const repairLogPath = path.join(workspace.repoRoot, 'docs', 'luau', 'repair-log.md');
  const luauReadmePath = path.join(workspace.repoRoot, 'docs', 'luau', 'README.md');
  fs.mkdirSync(path.dirname(repairLogPath), { recursive: true });

  const repairedFiles = [];
  for (const file of diagnosis.files) {
    const absolutePath = path.join(workspace.repoRoot, file);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    if (file.endsWith('.lua') || file.endsWith('.luau')) {
      const current = fs.readFileSync(absolutePath, 'utf8');
      const marker = '-- Luau repair: route hot paths through luau-repair and preserve host-local learning.';
      if (!current.includes(marker)) {
        fs.writeFileSync(absolutePath, `${current.trimEnd()}\n${marker}\n`, 'utf8');
      }
      repairedFiles.push(file);
      continue;
    }
    if (file.endsWith('.json')) {
      const current = readJson(absolutePath);
      const next = {
        ...current,
        luauRepair: {
          host: hostName,
          repairedAt: now,
          issues: diagnosis.issues,
        },
      };
      fs.writeFileSync(absolutePath, JSON.stringify(next, null, 2) + '\n', 'utf8');
      repairedFiles.push(file);
      continue;
    }
    if (file === 'AGENTS.md' || file === workspace.profileDocPath || file === path.relative(workspace.repoRoot, workspace.profileDocPath)) {
      repairedFiles.push(file);
      continue;
    }
  }

  const luauRepairBlock = [
    '<!-- agent-system-luau-repair-start -->',
    '## Luau Repair',
    '',
    `- Host: ${hostName}`,
    `- Selected path: ${diagnosis.selectedPath}`,
    `- Risk: ${diagnosis.risk}`,
    `- Proof: ${diagnosis.proof}`,
    '',
    '### Issues',
    ...diagnosis.issues.map((issue) => `- ${issue}`),
    '',
    '### Repaired Files',
    ...repairedFiles.map((file) => `- ${file}`),
    '<!-- agent-system-luau-repair-end -->',
  ].join('\n');

  const targets = [path.join(workspace.repoRoot, 'AGENTS.md'), workspace.profileDocPath, luauReadmePath];
  for (const filePath of targets) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    fs.writeFileSync(filePath, replaceMarkedBlock(current, 'agent-system-luau-repair-start', 'agent-system-luau-repair-end', luauRepairBlock), 'utf8');
  }

  const repairedAt = now;
  const docsDir = path.join(workspace.repoRoot, 'docs', 'luau');
  const currentPath = path.join(docsDir, 'current.json');
  const historyPath = path.join(docsDir, 'history.jsonl');
  const current = {
    kind: 'agent-system-luau-repair',
    version: 1,
    activeProfile: workspace.activeProfileName,
    activeHost: hostName,
    selectedPath: diagnosis.selectedPath,
    risk: diagnosis.risk,
    issues: diagnosis.issues,
    files: repairedFiles,
    proof: diagnosis.proof,
    ready: true,
    generatedAt: repairedAt,
  };
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(currentPath, JSON.stringify(current, null, 2) + '\n', 'utf8');
  fs.appendFileSync(historyPath, JSON.stringify({ ...current, eventType: 'repair', recordedAt: repairedAt }) + '\n', 'utf8');
  fs.writeFileSync(repairLogPath, [
    '# Luau Repair Log',
    '',
    `- Host: ${hostName}`,
    `- Selected path: ${diagnosis.selectedPath}`,
    `- Risk: ${diagnosis.risk}`,
    `- Proof: ${diagnosis.proof}`,
    '',
    '## Repaired Files',
    ...repairedFiles.map((file) => `- ${file}`),
    '',
    '## Issues',
    ...diagnosis.issues.map((issue) => `- ${issue}`),
    '',
  ].join('\n').trimEnd() + '\n', 'utf8');

  return current;
}

function writeLuauRepairMemory(workspace, hostName, diagnosis, repairedFiles) {
  const changePath = resolveHostMemoryPath(workspace.repoRoot, hostName, 'change');
  const hostPath = resolveHostMemoryPath(workspace.repoRoot, hostName, 'host');
  ensureMemoryChangeFile(workspace.repoRoot, hostName);
  const lesson = `Luau repair lesson: ${diagnosis.proof}; files: ${repairedFiles.join(', ')}.`;
  appendMemoryEntry(changePath, lesson);
  appendMemoryEntry(hostPath, lesson);
}

function handleLuauRepair(workspace, flags, positional) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const diagnosis = buildLuauDiagnosis(workspace, hostName);
  if (!diagnosis.active) {
    console.error('Usage: agent-system luau-repair (multi-file Luau repair required)');
    process.exit(1);
  }

  const repair = applyLuauRepair(workspace, diagnosis, hostName);
  writeLuauRepairMemory(workspace, hostName, diagnosis, repair.files);
  const trainingReport = buildTrainingReport(workspace, hostName, 'sync', { luau: true });
  syncTrainingArtifacts(workspace, trainingReport);
  writeTrainingRecord(workspace, trainingReport);
  captureTrainingMemory(workspace, trainingReport);
  const evalReport = buildEvaluationReport(workspace, hostName, 'promote', 75, { luau: true });
  writeEvaluationRecord(workspace, evalReport);
  writeEvaluationSummary(workspace, evalReport);
  captureEvaluationMemory(workspace, evalReport);

  console.log('[LUAU REPAIR]');
  console.log(`Files repaired: ${repair.files.join(', ')}`);
  console.log('[LUAU GATE]');
  console.log(`Ready: ${repair.ready ? 'yes' : 'no'}`);
  console.log(`Proof: ${diagnosis.proof}`);
}

function handleLuauGate(workspace, flags, positional) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const diagnosis = buildLuauDiagnosis(workspace, hostName);
  const currentRepair = readLuauRepairCurrent(workspace);
  const ready = Boolean(currentRepair.ready && diagnosis.active);
  console.log('[LUAU GATE]');
  console.log(`Host: ${hostName}`);
  console.log(`Ready: ${ready ? 'yes' : 'no'}`);
  console.log(`Proof: ${diagnosis.proof}`);
  if (!ready) {
    process.exit(1);
  }
}

function handleUpgrade(workspace, flags, positional) {
  const action = positional[0];
  if (action === 'apply') {
    handleUpgradeWrite(workspace, flags, positional.slice(1), 'apply');
    return;
  }
  if (action === 'sync') {
    handleUpgradeWrite(workspace, flags, positional.slice(1), 'sync');
    return;
  }
  if (action === 'replay') {
    handleUpgradeReplay(workspace, flags);
    return;
  }

  handleUpgradeWrite(workspace, flags, positional, 'upgrade');
}

function handleUpgradeWrite(workspace, flags, positional, mode) {
  const targetPath = flags.files?.[0] || positional[0] || path.join(workspace.repoRoot, 'AGENTS.md');
  const absoluteTargetPath = path.isAbsolute(targetPath) ? targetPath : path.resolve(workspace.repoRoot, targetPath);
  if (!fs.existsSync(absoluteTargetPath)) {
    console.error(`Upgrade target not found: ${targetPath}`);
    process.exit(1);
  }

  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const now = new Date().toISOString();
  const sourceText = fs.readFileSync(absoluteTargetPath, 'utf8');
  const report = buildUpgradeReport(workspace, sourceText, absoluteTargetPath, hostName);
  const upgradedText = renderUpgradeSyncDoc(sourceText, report);
  fs.writeFileSync(absoluteTargetPath, upgradedText, 'utf8');

  const profileDocPath = workspace.profileDocPath;
  let profileDocText = '';
  if (profileDocPath && path.resolve(profileDocPath) !== absoluteTargetPath && fs.existsSync(profileDocPath)) {
    profileDocText = fs.readFileSync(profileDocPath, 'utf8');
    fs.writeFileSync(profileDocPath, renderUpgradeSyncDoc(profileDocText, report), 'utf8');
  } else if (path.resolve(profileDocPath) === absoluteTargetPath) {
    profileDocText = upgradedText;
  }

  syncUpgradeMemory(workspace, report);

  const session = writeUpgradeSession(workspace, {
    sessionId: `${now.replace(/[:.]/g, '-')}-${hostName}-${mode}`,
    mode,
    outcome: 'synced',
    activeProfile: workspace.activeProfileName,
    activeHost: hostName,
    generatedAt: now,
    targetPath: path.relative(workspace.repoRoot, absoluteTargetPath),
    profileDocPath: path.relative(workspace.repoRoot, workspace.profileDocPath),
    replaySource: '',
    targetText: upgradedText,
    profileDocText,
    agents: report.agents,
    hosts: report.hosts,
    sections: report.sections,
  });

  console.log(mode === 'upgrade' ? '[UPGRADE]' : `[UPGRADE ${mode.toUpperCase()}]`);
  console.log(`Target: ${path.relative(workspace.repoRoot, absoluteTargetPath)}`);
  console.log(`Agents upgraded: ${report.agents.length}`);
  console.log(`Hosts synced: ${report.hosts.join(', ')}`);
  console.log(`Session: ${session.sessionId}`);
}

function handleUpgradeReplay(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const report = buildUpgradeReplayReport(workspace, hostName);
  console.log(renderUpgradeReplayReport(report));
  if (!report.ok) {
    process.exit(1);
  }
}

function handleTrain(workspace, flags, positional) {
  const modeInput = positional[0];
  if (modeInput === 'explain') {
    handleTrainExplain(workspace, flags);
    return;
  }
  if (modeInput === 'compare') {
    handleTrainCompare(workspace, flags);
    return;
  }
  if (modeInput === 'packs') {
    handleTrainingPacks(workspace, flags);
    return;
  }
  if (modeInput === 'rollback') {
    handleTrainRollback(workspace, flags);
    return;
  }
  const mode = normalizeTrainMode(modeInput);
  if (modeInput && mode !== modeInput.trim().toLowerCase()) {
    console.error(`Unknown train action: ${modeInput}`);
    process.exit(1);
  }
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const report = buildTrainingReport(workspace, hostName, mode, { luau: Boolean(flags.luau) });
  syncTrainingArtifacts(workspace, report);
  writeTrainingRecord(workspace, report);
  captureTrainingMemory(workspace, report);
  const continuity = applyTrainingContinuity(workspace, report, hostName);

  console.log('[TRAIN]');
  console.log(`Mode: ${report.mode}`);
  console.log(`Outcome: ${report.outcome}`);
  console.log(`Focus: ${report.focus || 'general'}`);
  console.log(`Agents trained: ${report.agents.length}`);
  console.log(`Training log: ${path.relative(workspace.repoRoot, report.summaryPath)}`);
  console.log(`Auto promotion: ${continuity.autoPromote ? 'yes' : 'no'}`);
  console.log(`Promoted lessons: ${continuity.promotions}`);
  console.log(`Continuous summary: ${path.relative(workspace.repoRoot, continuity.summaryPath)}`);
  if (continuity.packGenerated) {
    console.log(`Training pack: ${path.relative(workspace.repoRoot, continuity.packPath)}`);
  }
  for (const agent of report.agents) {
    console.log(`- ${agent.title}`);
  }
  if (report.luauLesson) {
    console.log(`Luau lesson: ${report.luauLesson}`);
  }
}

function handleEval(workspace, flags, positional) {
  const modeInput = positional[0];
  const mode = normalizeEvalMode(modeInput);
  if (modeInput && mode === 'invalid') {
    console.error(`Unknown eval action: ${modeInput}`);
    process.exit(1);
  }

  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const threshold = parseCount(flags.threshold, 75);
  const report = buildEvaluationReport(workspace, hostName, mode, threshold, { luau: Boolean(flags.luau) });
  writeEvaluationRecord(workspace, report);
  writeEvaluationSummary(workspace, report);
  if (report.promoted || report.luauLesson) {
    captureEvaluationMemory(workspace, report);
  }
  if (report.promoted) {
    syncEvaluationPromotions(workspace, report);
    saveLearningSnapshot(workspace.repoRoot, hostName, 'eval-promote');
  }

  console.log('[EVAL]');
  console.log(`Mode: ${report.mode}`);
  console.log(`Focus: ${report.focus || 'general'}`);
  console.log(`Score: ${report.score}`);
  console.log(`Verdict: ${report.verdict}`);
  console.log(`Compared against: ${report.comparedTo}`);
  console.log(`Delta: ${report.delta}`);
  console.log(`Promoted: ${report.promoted ? 'yes' : 'no'}`);
  console.log(`Evaluation log: ${path.relative(workspace.repoRoot, report.summaryPath)}`);
  if (report.luauLesson) {
    console.log(`Luau lesson: ${report.luauLesson}`);
  }
}

function normalizeTrainMode(value) {
  const mode = String(value || 'success').trim().toLowerCase();
  if (mode === 'error' || mode === 'review' || mode === 'replay' || mode === 'promote' || mode === 'sync') {
    return mode;
  }
  return value ? 'invalid' : 'success';
}

function normalizeEvalMode(value) {
  const mode = String(value || 'simulate').trim().toLowerCase();
  if (mode === 'simulate' || mode === 'score' || mode === 'compare' || mode === 'promote') {
    return mode;
  }
  return value ? 'invalid' : 'simulate';
}

function buildEvaluationReport(workspace, hostName, mode, threshold, flags = {}) {
  const now = new Date().toISOString();
  const current = readEvalCurrent(workspace);
  const history = readEvalHistory(workspace);
  const previous = history[history.length - 1] || current;
  const luauContext = getLuauLearningContext(workspace, flags);
  const scoreReport = scoreEvaluationState(workspace, hostName);
  const findings = [...scoreReport.findings];
  const lessons = [...scoreReport.lessons];
  let score = scoreReport.score;
  if (luauContext.active) {
    score = Math.min(100, score + 10);
    findings.push('Luau learning context active');
    lessons.push(luauContext.evaluationLesson);
  }
  const delta = typeof previous.score === 'number' ? score - previous.score : 0;
  const verdict = score >= threshold ? 'pass' : 'retry';
  const comparedTo = previous.sessionId || 'baseline';
  const sessionId = `${now.replace(/[:.]/g, '-')}-${hostName}-${mode}`;
  const summaryPath = path.join(workspace.evalDir, `${sessionId}.md`);
  const promoted = mode === 'promote' && verdict === 'pass';
  return {
    kind: 'agent-system-eval',
    version: 1,
    mode,
    outcome: mode === 'promote' ? (promoted ? 'promoted' : 'blocked') : mode === 'compare' ? 'compared' : 'simulated',
    activeProfile: workspace.activeProfileName,
    activeHost: hostName,
    focus: luauContext.active ? luauContext.focus : 'general',
    language: luauContext.active ? luauContext.language : 'general',
    sessionId,
    generatedAt: now,
    threshold,
    score,
    verdict,
    delta,
    comparedTo,
    promoted,
    findings,
    lessons,
    luauLesson: luauContext.active ? luauContext.evaluationLesson : '',
    summaryPath,
    current,
  };
}

function scoreEvaluationState(workspace, hostName) {
  const findings = [];
  const lessons = [];
  let score = 0;

  if (workspace.profile) {
    score += 10;
    findings.push('profile loaded');
  }
  if (workspace.profile && normalizeNewlines(renderProfileDoc(workspace.profile, workspace.manifest)) === normalizeNewlines(fs.readFileSync(workspace.profileDocPath, 'utf8'))) {
    score += 15;
    findings.push('profile doc in sync');
    lessons.push('Keep the human-facing profile doc synchronized with the structured profile.');
  }
  if (fs.existsSync(workspace.statusCurrentPath) && fs.existsSync(workspace.statusEventsPath)) {
    score += 10;
    findings.push('status state present');
  }
  if (fs.existsSync(workspace.changeCurrentPath) && fs.existsSync(workspace.changeHistoryPath)) {
    score += 10;
    findings.push('change state present');
  }
  if (fs.existsSync(workspace.trainingCurrentPath) && fs.existsSync(workspace.trainingHistoryPath)) {
    score += 10;
    findings.push('training state present');
  }
  if (fs.existsSync(workspace.evalCurrentPath) && fs.existsSync(workspace.evalHistoryPath)) {
    score += 10;
    findings.push('eval state present');
  }
  if (fs.existsSync(path.join(workspace.repoRoot, workspace.manifest.memory?.host?.[hostName] || `memory/host/${hostName}.md`))) {
    score += 10;
    findings.push(`host memory present for ${hostName}`);
  }
  if (fs.existsSync(path.join(workspace.repoRoot, workspace.manifest.memory?.profile || `memory/profile/${workspace.activeProfileName}.md`))) {
    score += 10;
    findings.push('profile memory present');
  }
  if (fs.existsSync(path.join(workspace.repoRoot, workspace.manifest.backup?.schema || 'docs/backup-schema.md'))) {
    score += 5;
    findings.push('backup schema present');
  }
  if (fs.existsSync(path.join(workspace.repoRoot, workspace.manifest.training?.schema || 'docs/training-schema.md'))) {
    score += 5;
    findings.push('training schema present');
  }
  if (fs.existsSync(path.join(workspace.repoRoot, workspace.manifest.eval?.schema || 'docs/evals-schema.md'))) {
    score += 5;
    findings.push('eval schema present');
  }
  const memoryAudit = auditMemory(workspace.repoRoot, workspace.manifest, workspace.profile, hostName);
  if (memoryAudit.ok) {
    score += 20;
    findings.push('memory audit clean');
    lessons.push('Promote only durable lessons after the host memory is clean.');
  }
  const changeGate = evaluateChangeGate(readChangeCurrent(workspace));
  if (changeGate.ready) {
    score += 5;
    findings.push('current change gate ready');
    lessons.push('Use change gate readiness as a proof signal before promotion.');
  }
  if (Array.isArray(workspace.profile?.reviewAgents) && workspace.profile.reviewAgents.length > 0) {
    score += 5;
    findings.push('review agents present');
  }

  return {
    score: Math.min(100, score),
    findings,
    lessons,
  };
}

function writeEvaluationRecord(workspace, report) {
  const current = {
    kind: report.kind,
    version: report.version,
    mode: report.mode,
    outcome: report.outcome,
    activeProfile: report.activeProfile,
    activeHost: report.activeHost,
    focus: report.focus,
    language: report.language,
    sessionId: report.sessionId,
    generatedAt: report.generatedAt,
    threshold: report.threshold,
    score: report.score,
    verdict: report.verdict,
    delta: report.delta,
    comparedTo: report.comparedTo,
    promoted: report.promoted,
    findings: report.findings,
    lessons: report.lessons,
    luauLesson: report.luauLesson,
    summaryPath: path.relative(workspace.repoRoot, report.summaryPath),
  };
  fs.mkdirSync(path.dirname(workspace.evalCurrentPath), { recursive: true });
  fs.writeFileSync(workspace.evalCurrentPath, JSON.stringify(current, null, 2) + '\n', 'utf8');

  const history = readEvalHistory(workspace);
  const historyEntry = {
    ...current,
    eventType: report.mode,
    recordedAt: report.generatedAt,
    sequence: history.length + 1,
  };
  fs.mkdirSync(path.dirname(workspace.evalHistoryPath), { recursive: true });
  fs.appendFileSync(workspace.evalHistoryPath, JSON.stringify(historyEntry) + '\n', 'utf8');
  captureBrainFromEvaluation(workspace, report);
}

function writeEvaluationSummary(workspace, report) {
  fs.mkdirSync(workspace.evalDir, { recursive: true });
  fs.writeFileSync(report.summaryPath, renderEvaluationSummaryDoc(report), 'utf8');
}

function syncEvaluationPromotions(workspace, report) {
  const docsBlock = renderEvaluationSyncBlock(report, 'docs');
  const memoryBlock = renderEvaluationSyncBlock(report, 'memory');
  const targets = [
    path.join(workspace.repoRoot, 'AGENTS.md'),
    workspace.profileDocPath,
    path.join(workspace.repoRoot, workspace.profile?.memory?.profileMemory || `memory/profile/${workspace.activeProfileName}.md`),
    resolveHostMemoryPath(workspace.repoRoot, report.activeHost, 'host'),
  ];

  for (const filePath of targets) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const block = filePath.includes(`${path.sep}memory${path.sep}`) ? memoryBlock : docsBlock;
    fs.writeFileSync(filePath, replaceMarkedBlock(current, 'agent-system-eval-start', 'agent-system-eval-end', block), 'utf8');
  }
}

function captureEvaluationMemory(workspace, report) {
  const changePath = resolveHostMemoryPath(workspace.repoRoot, report.activeHost, 'change');
  ensureMemoryChangeFile(workspace.repoRoot, report.activeHost);
  appendMemoryEntry(changePath, `Evaluation lesson: score ${report.score}, verdict ${report.verdict}, mode ${report.mode}.`);
  if (report.luauLesson) {
    appendMemoryEntry(changePath, report.luauLesson);
  }
}

function renderEvaluationSyncBlock(report, scope = 'docs') {
  const lines = [];
  lines.push('<!-- agent-system-eval-start -->');
  lines.push(scope === 'memory' ? '## Agent Evaluation Sync' : '## Evaluation Sync');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Profile: ${report.activeProfile}`);
  lines.push(`Host focus: ${report.activeHost}`);
  lines.push(`Focus: ${report.focus || 'general'}`);
  lines.push(`Mode: ${report.mode}`);
  lines.push(`Score: ${report.score}`);
  lines.push(`Verdict: ${report.verdict}`);
  lines.push(`Compared against: ${report.comparedTo}`);
  lines.push(`Delta: ${report.delta}`);
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding}`);
  }
  lines.push('');
  lines.push('### Evaluation Lesson');
  for (const lesson of report.lessons) {
    lines.push(`- ${lesson}`);
  }
  if (report.luauLesson) {
    lines.push('');
    lines.push('### Luau Focus');
    lines.push(`- ${report.luauLesson}`);
  }
  lines.push('');
  lines.push('### Host Sync');
  lines.push(`- ${report.activeHost}: evaluation lessons and memory are synchronized from this pass.`);
  lines.push('<!-- agent-system-eval-end -->');
  return lines.join('\n').trimEnd() + '\n';
}

function renderEvaluationSummaryDoc(report) {
  const lines = [];
  lines.push('# Evaluation Run');
  lines.push('');
  lines.push(`- Session: ${report.sessionId}`);
  lines.push(`- Mode: ${report.mode}`);
  lines.push(`- Outcome: ${report.outcome}`);
  lines.push(`- Profile: ${report.activeProfile}`);
  lines.push(`- Host: ${report.activeHost}`);
  lines.push(`- Focus: ${report.focus || 'general'}`);
  lines.push(`- Score: ${report.score}`);
  lines.push(`- Verdict: ${report.verdict}`);
  lines.push(`- Compared against: ${report.comparedTo}`);
  lines.push(`- Delta: ${report.delta}`);
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding}`);
  }
  lines.push('');
  lines.push('## Lessons');
  lines.push('');
  for (const lesson of report.lessons) {
    lines.push(`- ${lesson}`);
  }
  if (report.luauLesson) {
    lines.push('');
    lines.push('## Luau Focus');
    lines.push('');
    lines.push(`- ${report.luauLesson}`);
  }
  return lines.join('\n').trimEnd() + '\n';
}

function readEvalCurrent(workspace) {
  if (!fs.existsSync(workspace.evalCurrentPath)) {
    return {
      kind: 'agent-system-eval',
      version: 1,
      mode: 'idle',
      outcome: 'idle',
      activeProfile: workspace.activeProfileName,
      activeHost: workspace.activeHostName,
      focus: 'general',
      language: 'general',
      sessionId: '',
      generatedAt: '',
      threshold: 75,
      score: 0,
      verdict: 'retry',
      delta: 0,
      comparedTo: 'baseline',
      promoted: false,
      findings: [],
      lessons: [],
      luauLesson: '',
      summaryPath: '',
    };
  }
  try {
    return readJson(workspace.evalCurrentPath);
  } catch {
    return {
      kind: 'agent-system-eval',
      version: 1,
      mode: 'idle',
      outcome: 'idle',
      activeProfile: workspace.activeProfileName,
      activeHost: workspace.activeHostName,
      focus: 'general',
      language: 'general',
      sessionId: '',
      generatedAt: '',
      threshold: 75,
      score: 0,
      verdict: 'retry',
      delta: 0,
      comparedTo: 'baseline',
      promoted: false,
      findings: [],
      lessons: [],
      luauLesson: '',
      summaryPath: '',
    };
  }
}

function readEvalHistory(workspace) {
  if (!fs.existsSync(workspace.evalHistoryPath)) {
    return [];
  }
  const entries = [];
  const lines = fs.readFileSync(workspace.evalHistoryPath, 'utf8').split(/\r?\n/);
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

function buildTrainingReport(workspace, hostName, mode, flags = {}) {
  const now = new Date().toISOString();
  const current = readTrainingCurrent(workspace);
  const history = readTrainingHistory(workspace);
  const latest = mode === 'replay' ? history[history.length - 1] || current : current;
  const agents = buildTrainingAgents(workspace.profile);
  const luauContext = getLuauLearningContext(workspace, flags);
  const outcome = mode === 'error' ? 'held' : mode === 'review' ? 'reviewed' : mode === 'replay' ? 'replayed' : mode === 'promote' ? 'promoted' : 'applied';
  const sessionId = `${now.replace(/[:.]/g, '-')}-${hostName}-${mode}`;
  const summaryPath = path.join(workspace.trainingDir, `${sessionId}.md`);
  const lesson = buildTrainingLesson(mode, hostName, latest, agents, workspace.profile);
  const luauLesson = luauContext.active ? luauContext.trainingLesson : '';

  return {
    kind: 'agent-system-training',
    version: 1,
    mode,
    outcome,
    activeProfile: workspace.activeProfileName,
    activeHost: hostName,
    focus: luauContext.active ? luauContext.focus : 'general',
    language: luauContext.active ? luauContext.language : 'general',
    sessionId,
    generatedAt: now,
    agents,
    lesson,
    luauLesson,
    summaryPath,
    current,
    latest,
  };
}

function buildTrainingAgents(profile) {
  const agents = [];
  const seen = new Set();
  for (const domain of profile?.ownedDomains || []) {
    const title = humanize(String(domain.owner || 'agent'));
    const key = normalize(title);
    if (seen.has(key)) continue;
    seen.add(key);
    agents.push({
      title,
      role: domain.owner || 'agent',
      domain: domain.domain || 'unknown',
      notes: [
        domain.notes || 'Keep the owned domain stable.',
        'Keep ownership explicit and preserve baseline proof when the domain changes.',
      ],
    });
  }
  for (const reviewAgent of profile?.reviewAgents || []) {
    const title = humanize(reviewAgent);
    const key = normalize(title);
    if (seen.has(key)) continue;
    seen.add(key);
    agents.push({
      title,
      role: reviewAgent,
      domain: 'review',
      notes: [
        'Review the training block for proof, consistency, and missing guardrails.',
        'Block on drift between the structured profile and the human-facing docs.',
      ],
    });
  }
  return agents;
}

function buildTrainingLesson(mode, hostName, source, agents, profile) {
  if (mode === 'error') {
    return `Prevention rule: keep ${hostName} change lessons local until the baseline, regression matrix, and owned domains are complete for ${profile?.name || 'the active profile'}.`;
  }
  if (mode === 'replay') {
    return `Replay lesson: reuse the latest durable lesson without duplicating the training sync block for ${hostName}.`;
  }
  if (mode === 'review') {
    return `Review lesson: keep ${hostName} training aligned with the active profile memory and the latest gate outcome.`;
  }
  if (mode === 'promote') {
    return `Promotion rule: move only durable lessons into ${hostName} host memory after the training block has been proven idempotent.`;
  }
  if (mode === 'sync') {
    return `Sync lesson: keep the training block idempotent across AGENTS.md, profile memory, and host memory for ${hostName}.`;
  }
  const visibleAgents = agents.slice(0, 4).map((agent) => agent.title).join(', ');
  const sourceMode = source?.mode || 'fresh';
  return `Training lesson: keep ${visibleAgents || 'the active agents'} aligned with the active profile, preserve the owned domains, and mirror durable notes into ${hostName} memory. Source mode: ${sourceMode}.`;
}

function getLuauLearningContext(workspace, flags = {}) {
  const intake = readChangeCurrent(workspace);
  const sourceFiles = Array.isArray(intake.sourceFiles) ? intake.sourceFiles : [];
  const repair = readLuauRepairCurrent(workspace);
  const repairFiles = Array.isArray(repair.files) ? repair.files : [];
  const candidate = [intake.target, ...sourceFiles].find((file) => isLuauQuickFile(file));
  const repairCandidate = repair.ready ? repairFiles.find((file) => isLuauQuickFile(file)) : '';
  const active = Boolean(flags.luau || intake.luauQuick || intake.language === 'Luau' || candidate || repairCandidate);
  if (!active) {
    return {
      active: false,
      focus: 'general',
      language: 'general',
      target: '',
      trainingLesson: '',
      evaluationLesson: '',
    };
  }

  const target = candidate || repairCandidate || intake.target || repair.target || 'Luau script';
  const base = path.posix.basename(target || 'Luau script');
  const trainingLesson = repairCandidate
    ? `Luau lesson: keep ${base} repair proof synchronized, preserve host-local memory, and reuse the Luau repair gate for follow-up changes.`
    : `Luau lesson: keep ${base} hot-path safe, preserve host-local memory, and prefer the Luau quick gate for one-file changes.`;
  const evaluationLesson = repairCandidate
    ? `Luau lesson: score ${base} repair proof against hot-path safety, remote discipline, and host-scoped memory before promotion.`
    : `Luau lesson: score ${base} against hot-path safety, remote discipline, and host-scoped memory before promotion.`;
  return {
    active: true,
    focus: 'Luau',
    language: 'Luau',
    target,
    trainingLesson,
    evaluationLesson,
  };
}

function syncTrainingArtifacts(workspace, report) {
  const rootBlock = renderTrainingSyncBlock(report, 'docs');
  const memoryBlock = renderTrainingSyncBlock(report, 'memory');
  const targets = [
    workspace.repoRoot && path.join(workspace.repoRoot, 'AGENTS.md'),
    workspace.profileDocPath,
    workspace.profile?.memory?.profileMemory ? path.join(workspace.repoRoot, workspace.profile.memory.profileMemory) : path.join(workspace.repoRoot, 'memory/profile/imphub.md'),
    resolveHostMemoryPath(workspace.repoRoot, report.activeHost, 'host'),
  ].filter(Boolean);

  for (const filePath of targets) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const block = filePath.includes(`${path.sep}memory${path.sep}`) ? memoryBlock : rootBlock;
    fs.writeFileSync(filePath, replaceMarkedBlock(current, 'agent-system-training-start', 'agent-system-training-end', block), 'utf8');
  }

  fs.mkdirSync(workspace.trainingDir, { recursive: true });
  fs.writeFileSync(report.summaryPath, renderTrainingSummaryDoc(report), 'utf8');
}

function renderTrainingSyncBlock(report, scope) {
  const title = scope === 'memory' ? 'Agent Training Sync' : 'Training Sync';
  const lines = [];
  lines.push('<!-- agent-system-training-start -->');
  lines.push(`## ${title}`);
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Profile: ${report.activeProfile}`);
  lines.push(`Host focus: ${report.activeHost}`);
  lines.push(`Mode: ${report.mode}`);
  lines.push(`Outcome: ${report.outcome}`);
  lines.push(`Agents trained: ${report.agents.length}`);
  lines.push('');
  for (const agent of report.agents) {
    lines.push(`### ${agent.title}`);
    lines.push(`- Role: ${agent.role}`);
    lines.push(`- Domain: ${agent.domain}`);
    for (const note of agent.notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }
  lines.push('### Learning Rule');
  lines.push(`- ${report.lesson}`);
  if (report.luauLesson) {
    lines.push('');
    lines.push('### Luau Focus');
    lines.push(`- ${report.luauLesson}`);
  }
  lines.push('');
  lines.push('### Host Sync');
  lines.push(`- ${report.activeHost}: training lessons and memory are synchronized from this pass.`);
  lines.push('<!-- agent-system-training-end -->');
  return lines.join('\n').trimEnd() + '\n';
}

function renderTrainingSummaryDoc(report) {
  const lines = [];
  lines.push('# Training Run');
  lines.push('');
  lines.push(`- Session: ${report.sessionId}`);
  lines.push(`- Mode: ${report.mode}`);
  lines.push(`- Outcome: ${report.outcome}`);
  lines.push(`- Profile: ${report.activeProfile}`);
  lines.push(`- Host: ${report.activeHost}`);
  lines.push(`- Agents trained: ${report.agents.length}`);
  lines.push('');
  lines.push('## Lesson');
  lines.push('');
  lines.push(`- ${report.lesson}`);
  if (report.luauLesson) {
    lines.push('');
    lines.push('## Luau Focus');
    lines.push('');
    lines.push(`- ${report.luauLesson}`);
  }
  lines.push('');
  lines.push('## Agents');
  lines.push('');
  for (const agent of report.agents) {
    lines.push(`### ${agent.title}`);
    lines.push(`- Role: ${agent.role}`);
    lines.push(`- Domain: ${agent.domain}`);
    for (const note of agent.notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

function captureTrainingMemory(workspace, report) {
  const changePath = resolveHostMemoryPath(workspace.repoRoot, report.activeHost, 'change');
  ensureMemoryChangeFile(workspace.repoRoot, report.activeHost);
  const line = report.mode === 'error'
    ? `Prevention rule: ${report.lesson}`
    : `Training lesson: ${report.lesson}`;
  appendMemoryEntry(changePath, line);
  if (report.luauLesson) {
    appendMemoryEntry(changePath, report.luauLesson);
  }
}

function handleTrainExplain(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const report = buildTrainingExplainReport(workspace, hostName);
  writeTrainingHostAudit(workspace.repoRoot, 'explain', hostName, report, renderTrainingExplainDoc(report));
  console.log('[TRAIN EXPLAIN]');
  console.log(`Host: ${hostName}`);
  console.log(`Reason: ${report.reason}`);
  console.log(`History: ${path.relative(workspace.repoRoot, report.historyPath)}`);
  console.log(`Current: ${path.relative(workspace.repoRoot, report.currentPath)}`);
  if (report.trainingPackPath) {
    console.log(`Training pack: ${path.relative(workspace.repoRoot, report.trainingPackPath)}`);
  }
  if (report.luauLesson) {
    console.log(`Luau lesson: ${report.luauLesson}`);
  }
}

function handleTrainCompare(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const report = buildTrainingCompareReport(workspace, hostName);
  writeTrainingHostAudit(workspace.repoRoot, 'compare', hostName, report, renderTrainingCompareDoc(report));
  console.log('[TRAIN COMPARE]');
  console.log(`Host: ${hostName}`);
  console.log(`Compared runs: ${report.currentSession || 'baseline'} vs ${report.previousSession || 'baseline'}`);
  console.log(`Delta: ${report.delta}`);
  console.log(`History: ${path.relative(workspace.repoRoot, report.historyPath)}`);
  if (report.trainingPackPath) {
    console.log(`Training pack: ${path.relative(workspace.repoRoot, report.trainingPackPath)}`);
  }
}

function handleTrainingPacks(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const report = maybeGenerateTrainingPack(workspace.repoRoot, hostName);
  console.log('[TRAIN PACKS]');
  console.log(`Host: ${hostName}`);
  console.log(`Generated: ${report.generated ? 'yes' : 'no'}`);
  console.log(`Cycles: ${report.cycles}`);
  console.log(`Pack: ${path.relative(workspace.repoRoot, report.path)}`);
}

function handleTrainRollback(workspace, flags) {
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const latest = readLatestLearningSnapshot(workspace.repoRoot, hostName);
  if (!latest.snapshot) {
    console.error(`No learning snapshot found for host ${hostName}`);
    process.exit(1);
  }
  const restored = restoreLearningSnapshot(workspace.repoRoot, latest.snapshot);
  console.log('[TRAIN ROLLBACK]');
  console.log(`Host: ${hostName}`);
  console.log(`Restored: ${path.relative(workspace.repoRoot, latest.snapshotPath)}`);
  console.log(`Files: ${restored.fileCount}`);
}

function applyTrainingContinuity(workspace, report, hostName) {
  const autoPromote = report.mode !== 'error';
  const promotionReport = autoPromote
    ? learnMemory(workspace.repoRoot, hostName, 2, true)
    : { promoted: 0, duplicates: [], promotions: [] };
  if (autoPromote) {
    teachHostMemory(workspace.repoRoot, hostName);
    generateLearningPack(workspace.repoRoot, hostName);
  }

  const current = {
    kind: 'agent-system-training-continuity',
    version: 1,
    activeProfile: report.activeProfile,
    activeHost: hostName,
    mode: report.mode,
    outcome: report.outcome,
    focus: report.focus,
    language: report.language,
    generatedAt: report.generatedAt,
    summaryPath: path.relative(workspace.repoRoot, report.summaryPath),
    continuityPath: path.relative(workspace.repoRoot, workspace.trainingContinuousReadmePath),
    trainingHistory: path.relative(workspace.repoRoot, workspace.trainingHistoryPath),
    promotedMemory: promotionReport.promoted,
    promotions: promotionReport.promotions.map((promotion) => promotion.text),
    autoPromote,
    luauLesson: report.luauLesson,
    hostMemoryPath: path.relative(workspace.repoRoot, resolveHostMemoryPath(workspace.repoRoot, hostName, 'host')),
    packPath: path.relative(workspace.repoRoot, resolveHostMemoryPath(workspace.repoRoot, hostName, 'packs')),
    trainingPackVersion: 1,
    trainingPackPath: '',
    trainingPackGenerated: false,
  };

  fs.mkdirSync(path.dirname(workspace.trainingContinuousPath), { recursive: true });
  fs.writeFileSync(workspace.trainingContinuousPath, JSON.stringify(current, null, 2) + '\n', 'utf8');
  fs.writeFileSync(workspace.trainingContinuousReadmePath, renderTrainingContinuousDoc(current), 'utf8');

  const historyEntry = {
    ...current,
    recordedAt: report.generatedAt,
    sequence: readTrainingContinuousHistory(workspace).length + 1,
  };
  fs.appendFileSync(workspace.trainingContinuousHistoryPath, JSON.stringify(historyEntry) + '\n', 'utf8');

  const packReport = maybeGenerateTrainingPack(workspace.repoRoot, hostName);
  if (packReport.generated) {
    current.trainingPackPath = path.relative(workspace.repoRoot, packReport.path);
    current.trainingPackGenerated = true;
    fs.writeFileSync(workspace.trainingContinuousPath, JSON.stringify(current, null, 2) + '\n', 'utf8');
    fs.writeFileSync(workspace.trainingContinuousReadmePath, renderTrainingContinuousDoc(current), 'utf8');
  }

  if (autoPromote) {
    saveLearningSnapshot(workspace.repoRoot, hostName, 'train');
  }

  return {
    autoPromote,
    promotions: promotionReport.promoted,
    summaryPath: workspace.trainingContinuousReadmePath,
    packGenerated: packReport.generated,
    packPath: packReport.path,
  };
}

function renderTrainingContinuousDoc(current) {
  const lines = [];
  lines.push('# Continuous Training');
  lines.push('');
  lines.push(`- Generated: ${current.generatedAt}`);
  lines.push(`- Profile: ${current.activeProfile}`);
  lines.push(`- Host: ${current.activeHost}`);
  lines.push(`- Mode: ${current.mode}`);
  lines.push(`- Outcome: ${current.outcome}`);
  lines.push(`- Focus: ${current.focus || 'general'}`);
  lines.push(`- Auto promotion: ${current.autoPromote ? 'yes' : 'no'}`);
  lines.push(`- Promoted lessons: ${current.promotedMemory}`);
  lines.push(`- Training log: ${current.summaryPath}`);
  lines.push(`- Host memory: ${current.hostMemoryPath}`);
  lines.push(`- Pack: ${current.packPath}`);
  lines.push(`- Pack version: ${current.trainingPackVersion || 1}`);
  if (current.luauLesson) {
    lines.push('');
    lines.push('## Luau Focus');
    lines.push(`- ${current.luauLesson}`);
  }
  if (Array.isArray(current.promotions) && current.promotions.length > 0) {
    lines.push('');
    lines.push('## Promotions');
    for (const promotion of current.promotions) {
      lines.push(`- ${promotion}`);
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}

function readTrainingContinuousHistory(workspace) {
  if (!fs.existsSync(workspace.trainingContinuousHistoryPath)) {
    return [];
  }
  const entries = [];
  const lines = fs.readFileSync(workspace.trainingContinuousHistoryPath, 'utf8').split(/\r?\n/);
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

function readTrainingContinuousCurrent(workspace) {
  if (!fs.existsSync(workspace.trainingContinuousPath)) {
    return {
      kind: 'agent-system-training-continuity',
      version: 1,
      activeProfile: workspace.activeProfileName,
      activeHost: workspace.activeHostName,
      mode: 'success',
      outcome: 'applied',
      focus: 'general',
      language: 'general',
      generatedAt: '',
      summaryPath: '',
      continuityPath: '',
      trainingHistory: '',
      promotedMemory: 0,
      promotions: [],
      autoPromote: true,
      luauLesson: '',
      hostMemoryPath: '',
      packPath: '',
      trainingPackVersion: 1,
      trainingPackPath: '',
      trainingPackGenerated: false,
    };
  }
  try {
    return readJson(workspace.trainingContinuousPath);
  } catch {
    return {
      kind: 'agent-system-training-continuity',
      version: 1,
      activeProfile: workspace.activeProfileName,
      activeHost: workspace.activeHostName,
      mode: 'success',
      outcome: 'applied',
      focus: 'general',
      language: 'general',
      generatedAt: '',
      summaryPath: '',
      continuityPath: '',
      trainingHistory: '',
      promotedMemory: 0,
      promotions: [],
      autoPromote: true,
      luauLesson: '',
      hostMemoryPath: '',
      packPath: '',
      trainingPackVersion: 1,
      trainingPackPath: '',
      trainingPackGenerated: false,
    };
  }
}

function buildTrainingExplainReport(workspace, hostName) {
  const normalizedHost = normalizeHostName(hostName);
  const current = readTrainingCurrent(workspace);
  const continuous = readTrainingContinuousCurrent(workspace);
  const history = readTrainingHistory(workspace).filter((entry) => normalizeHostName(entry.activeHost) === normalizedHost);
  const continuousHistory = readTrainingContinuousHistory(workspace).filter((entry) => normalizeHostName(entry.activeHost) === normalizedHost);
  const latest = history[history.length - 1] || current;
  const latestContinuous = continuousHistory[continuousHistory.length - 1] || continuous;
  const reason = latestContinuous.autoPromote
    ? 'successful cycles auto-promote durable lessons and refresh the host pack'
    : 'training is waiting for a successful cycle before auto-promotion';
  return {
    host: normalizedHost,
    currentSession: latest.sessionId || '',
    currentPath: workspace.trainingCurrentPath,
    historyPath: path.join(workspace.repoRoot, 'docs', 'training', 'explain', `${normalizedHost}.jsonl`),
    trainingPackPath: latestContinuous.trainingPackPath ? path.join(workspace.repoRoot, latestContinuous.trainingPackPath) : '',
    reason,
    autoPromote: Boolean(latestContinuous.autoPromote),
    promotedMemory: latestContinuous.promotedMemory || 0,
    luauLesson: latestContinuous.luauLesson || latest.luauLesson || '',
    currentLesson: latest.lesson || '',
    latestContinuous,
    current,
    continuous,
  };
}

function buildTrainingCompareReport(workspace, hostName) {
  const normalizedHost = normalizeHostName(hostName);
  const history = readTrainingContinuousHistory(workspace).filter((entry) => normalizeHostName(entry.activeHost) === normalizedHost);
  const current = history[history.length - 1] || null;
  const previous = history[history.length - 2] || null;
  const delta = current && previous
    ? `promotedMemory ${previous.promotedMemory || 0} -> ${current.promotedMemory || 0}; autoPromote ${previous.autoPromote ? 'yes' : 'no'} -> ${current.autoPromote ? 'yes' : 'no'}`
    : 'baseline only';
  return {
    host: normalizedHost,
    currentSession: current?.generatedAt ? `${normalizedHost}-${current.generatedAt}` : '',
    previousSession: previous?.generatedAt ? `${normalizedHost}-${previous.generatedAt}` : '',
    historyPath: path.join(workspace.repoRoot, 'docs', 'training', 'compare', `${normalizedHost}.jsonl`),
    trainingPackPath: current?.trainingPackPath ? path.join(workspace.repoRoot, current.trainingPackPath) : '',
    delta,
    current,
    previous,
  };
}

function renderTrainingExplainDoc(report) {
  const lines = [];
  lines.push('# Training Explain');
  lines.push('');
  lines.push(`- Host: ${report.host}`);
  lines.push(`- Reason: ${report.reason}`);
  lines.push(`- Auto promotion: ${report.autoPromote ? 'yes' : 'no'}`);
  lines.push(`- Promoted lessons: ${report.promotedMemory}`);
  lines.push(`- Current lesson: ${report.currentLesson || 'n/a'}`);
  lines.push(`- Current training log: ${path.relative(process.cwd(), report.currentPath)}`);
  if (report.trainingPackPath) {
    lines.push(`- Training pack: ${path.relative(process.cwd(), report.trainingPackPath)}`);
  }
  if (report.luauLesson) {
    lines.push('');
    lines.push('## Luau Focus');
    lines.push(`- ${report.luauLesson}`);
  }
  return lines.join('\n').trimEnd() + '\n';
}

function renderTrainingCompareDoc(report) {
  const lines = [];
  lines.push('# Training Compare');
  lines.push('');
  lines.push(`- Host: ${report.host}`);
  lines.push(`- Current session: ${report.currentSession || 'baseline'}`);
  lines.push(`- Previous session: ${report.previousSession || 'baseline'}`);
  lines.push(`- Delta: ${report.delta}`);
  if (report.trainingPackPath) {
    lines.push(`- Training pack: ${path.relative(process.cwd(), report.trainingPackPath)}`);
  }
  return lines.join('\n').trimEnd() + '\n';
}

function writeTrainingHostAudit(repoRoot, kind, hostName, report, summaryText) {
  const historyPath = path.join(repoRoot, 'docs', 'training', kind, `${hostName}.jsonl`);
  const summaryPath = path.join(repoRoot, 'docs', 'training', kind, `${hostName}.md`);
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  const entry = {
    kind: `agent-system-training-${kind}`,
    host: hostName,
    generatedAt: new Date().toISOString(),
    ...report,
  };
  fs.appendFileSync(historyPath, JSON.stringify(entry) + '\n', 'utf8');
  fs.writeFileSync(summaryPath, summaryText, 'utf8');
}

function readTrainingContinuousHistoryFromRepo(repoRoot) {
  const historyPath = path.join(repoRoot, 'docs', 'training', 'continuous-history.jsonl');
  if (!fs.existsSync(historyPath)) {
    return [];
  }
  const entries = [];
  const lines = fs.readFileSync(historyPath, 'utf8').split(/\r?\n/);
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

function maybeGenerateTrainingPack(repoRoot, hostName, cycleCountOverride = null) {
  const normalizedHost = normalizeHostName(hostName);
  const history = readTrainingContinuousHistoryFromRepo(repoRoot).filter((entry) => normalizeHostName(entry.activeHost) === normalizedHost);
  const cycles = Number.isFinite(cycleCountOverride) ? cycleCountOverride : history.length;
  const packPath = path.join(repoRoot, 'docs', 'training', 'packs', `${normalizedHost}.md`);
  const packDataPath = path.join(repoRoot, 'docs', 'training', 'packs', `${normalizedHost}.json`);
  if (cycles < 3) {
    return { generated: false, cycles, path: packPath };
  }

  const hostMemoryPath = resolveHostMemoryPath(repoRoot, normalizedHost, 'host');
  const hostLessons = readMemoryBullets(hostMemoryPath).slice(-8);
  const current = history[history.length - 1] || null;
  const lines = [];
  lines.push('# Training Pack');
  lines.push('');
  lines.push(`- Host: ${normalizedHost}`);
  lines.push(`- Cycles: ${cycles}`);
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Pack version: 1`);
  lines.push(`- Current lesson: ${current?.luauLesson || current?.promotions?.[0] || 'n/a'}`);
  lines.push('');
  lines.push('## Durable Lessons');
  if (hostLessons.length > 0) {
    for (const lesson of hostLessons) {
      lines.push(`- ${stripBulletPrefix(lesson)}`);
    }
  } else {
    lines.push('- No durable lessons yet.');
  }
  lines.push('');
  lines.push('## Continuous Cycles');
  for (const cycle of history.slice(-5)) {
    lines.push(`- ${cycle.mode}: promoted ${cycle.promotedMemory || 0} lesson(s)`);
  }
  fs.mkdirSync(path.dirname(packPath), { recursive: true });
  fs.writeFileSync(packPath, lines.join('\n').trimEnd() + '\n', 'utf8');
  fs.writeFileSync(packDataPath, JSON.stringify({
    packVersion: 1,
    host: normalizedHost,
    cycles,
    generatedAt: new Date().toISOString(),
    hostMemoryPath: path.relative(repoRoot, hostMemoryPath),
    packPath: path.relative(repoRoot, packPath),
  }, null, 2) + '\n', 'utf8');
  return { generated: true, cycles, path: packPath };
}

function handleBrain(workspace, flags, positional) {
  const action = positional[0] || 'query';
  if (action === 'add') {
    handleBrainAdd(workspace, flags, positional.slice(1));
    return;
  }
  if (action === 'query') {
    handleBrainQuery(workspace, flags, positional.slice(1));
    return;
  }
  if (action === 'explain') {
    handleBrainExplain(workspace, flags, positional.slice(1));
    return;
  }
  if (action === 'promote') {
    handleBrainPromote(workspace, flags, positional.slice(1));
    return;
  }
  if (action === 'demote') {
    handleBrainDemote(workspace, flags, positional.slice(1));
    return;
  }
  if (action === 'prune') {
    handleBrainPrune(workspace);
    return;
  }
  if (action === 'snapshot') {
    handleBrainSnapshot(workspace, flags, positional.slice(1));
    return;
  }
  if (action === 'restore') {
    handleBrainRestore(workspace, flags, positional.slice(1));
    return;
  }
  if (action === 'diff') {
    handleBrainDiff(workspace, flags, positional.slice(1));
    return;
  }
  if (action === 'sync') {
    handleBrainSync(workspace);
    return;
  }
  if (action === 'dedupe') {
    handleBrainDedupe(workspace, flags, positional.slice(1));
    return;
  }
  if (action === 'list') {
    handleBrainList(workspace, flags, positional.slice(1));
    return;
  }
  console.error(`Unknown brain action: ${action}`);
  process.exit(1);
}

function handleBrainAdd(workspace, flags, positional) {
  const summary = positional.join(' ').trim() || flags.detail || flags.intent || flags.name || 'Brain entry';
  const report = appendBrainEvent(workspace, {
    source: flags.source || 'manual',
    scope: flags.scope || 'system',
    status: flags.status || 'candidate',
    confidence: parseCount(flags.confidence, 70),
    title: flags.title || flags.name || summary,
    summary,
    facts: normalizeChangeList(flags.fact || flags.detail || ''),
    tags: normalizeChangeList(flags.tag || ''),
    relatedPaths: normalizeChangeList(flags.path || ''),
    evidence: flags.reason || '',
  });
  console.log('[BRAIN ADD]');
  console.log(`Brain ID: ${report.brainId}`);
  console.log(`Scope: ${report.scope}`);
  console.log(`Status: ${report.status}`);
  console.log(`Summary: ${report.summary}`);
}

function handleBrainQuery(workspace, flags, positional) {
  const query = positional.join(' ').trim() || flags.detail || flags.intent || '';
  if (!query) {
    console.error('Usage: agent-system brain query <text>');
    process.exit(1);
  }
  const report = queryBrainEntries(workspace, query, { explain: false });
  console.log('[BRAIN QUERY]');
  console.log(`Query: ${query}`);
  console.log(`Scope: ${flags.scope || 'all'}`);
  console.log(`Hits: ${report.matches.length}`);
  for (const match of report.matches) {
    console.log(`- [${match.status}] ${match.title} (${match.scope}, ${match.source}, ${match.confidence})`);
    console.log(`  ${match.summary}`);
  }
}

function handleBrainExplain(workspace, flags, positional) {
  const query = positional.join(' ').trim() || flags.detail || flags.intent || '';
  if (!query) {
    console.error('Usage: agent-system brain explain <text>');
    process.exit(1);
  }
  const report = queryBrainEntries(workspace, query, { explain: true });
  console.log('[BRAIN EXPLAIN]');
  console.log(`Query: ${query}`);
  console.log(`Scope: ${flags.scope || 'all'}`);
  console.log(`Hits: ${report.matches.length}`);
  for (const match of report.matches) {
    console.log(`- [${match.status}] ${match.title} (${match.scope}, ${match.source}, ${match.confidence})`);
    console.log(`  Matched: ${match.reasons.join(', ')}`);
  }
}

function handleBrainPromote(workspace, flags, positional) {
  const query = positional.join(' ').trim() || flags.brainId || flags.detail || flags.intent || '';
  if (!query) {
    console.error('Usage: agent-system brain promote <text|id>');
    process.exit(1);
  }
  const matches = queryBrainEntries(workspace, query, { explain: true }).matches;
  if (matches.length === 0) {
    console.error(`No brain entry matched: ${query}`);
    process.exit(1);
  }
  const promoted = appendBrainEvent(workspace, {
    brainId: matches[0].brainId,
    source: 'brain-promote',
    scope: flags.scope || matches[0].scope,
    status: 'active',
    confidence: Math.min(100, (matches[0].confidence || 70) + 10),
    title: matches[0].title,
    summary: matches[0].summary,
    facts: matches[0].facts,
    tags: matches[0].tags,
    relatedPaths: matches[0].relatedPaths,
    evidence: `Promoted from ${matches[0].status}`,
  });
  console.log('[BRAIN PROMOTE]');
  console.log(`Brain ID: ${promoted.brainId}`);
  console.log(`Scope: ${promoted.scope}`);
  console.log(`Status: ${promoted.status}`);
}

function handleBrainDemote(workspace, flags, positional) {
  const query = positional.join(' ').trim() || flags.brainId || flags.detail || flags.intent || '';
  if (!query) {
    console.error('Usage: agent-system brain demote <text|id>');
    process.exit(1);
  }
  const matches = queryBrainEntries(workspace, query, { explain: true }).matches;
  if (matches.length === 0) {
    console.error(`No brain entry matched: ${query}`);
    process.exit(1);
  }
  const demoted = appendBrainEvent(workspace, {
    brainId: matches[0].brainId,
    source: 'brain-demote',
    scope: flags.scope || matches[0].scope,
    status: 'demoted',
    confidence: Math.max(0, (matches[0].confidence || 50) - 20),
    title: matches[0].title,
    summary: matches[0].summary,
    facts: matches[0].facts,
    tags: matches[0].tags,
    relatedPaths: matches[0].relatedPaths,
    evidence: `Demoted from ${matches[0].status}`,
  });
  console.log('[BRAIN DEMOTE]');
  console.log(`Brain ID: ${demoted.brainId}`);
  console.log(`Scope: ${demoted.scope}`);
  console.log(`Status: ${demoted.status}`);
}

function handleBrainPrune(workspace) {
  const report = pruneBrainHistory(workspace);
  console.log('[BRAIN PRUNE]');
  console.log(`Pruned: ${report.pruned}`);
  for (const note of report.notes) {
    console.log(`- ${note}`);
  }
}

function handleBrainSnapshot(workspace, flags, positional) {
  const outputPath = flags.files?.[0] || positional[0] || path.join(workspace.repoRoot, workspace.manifest.brain?.snapshots || 'docs/brain/snapshots', `${normalizeHostName(workspace.activeHostName)}-brain.json`);
  const absolutePath = path.isAbsolute(outputPath) ? outputPath : path.resolve(workspace.repoRoot, outputPath);
  const snapshot = buildBrainSnapshot(workspace);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  console.log('[BRAIN SNAPSHOT]');
  console.log(`Host: ${snapshot.activeHost}`);
  console.log(`Profile: ${snapshot.activeProfile}`);
  console.log(`Entries: ${snapshot.history.length}`);
  console.log(`Wrote: ${path.relative(workspace.repoRoot, absolutePath)}`);
}

function handleBrainRestore(workspace, flags, positional) {
  const inputPath = flags.files?.[0] || positional[0];
  if (!inputPath) {
    console.error('Usage: agent-system brain restore --file <snapshot.json>');
    process.exit(1);
  }
  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.resolve(workspace.repoRoot, inputPath);
  const snapshot = readJson(absolutePath);
  const report = restoreBrainSnapshot(workspace, snapshot);
  console.log('[BRAIN RESTORE]');
  console.log(`Host: ${report.activeHost}`);
  console.log(`Profile: ${report.activeProfile}`);
  console.log(`Restored: ${report.entries}`);
}

function handleBrainDiff(workspace, flags, positional) {
  const inputPath = flags.files?.[0] || positional[0];
  if (!inputPath) {
    console.error('Usage: agent-system brain diff --file <snapshot.json>');
    process.exit(1);
  }
  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.resolve(workspace.repoRoot, inputPath);
  const snapshot = readJson(absolutePath);
  const report = diffBrainSnapshot(workspace, snapshot);
  console.log('[BRAIN DIFF]');
  console.log(`Host: ${report.activeHost}`);
  console.log(`Profile: ${report.activeProfile}`);
  console.log(`Changed: ${report.changed.length}`);
  for (const item of report.changed) {
    console.log(`- ${item}`);
  }
}

function handleBrainSync(workspace) {
  const current = materializeBrainCurrent(workspace);
  writeBrainCurrent(workspace, current);
  console.log('[BRAIN SYNC]');
  console.log(`Host: ${current.activeHost}`);
  console.log(`Profile: ${current.activeProfile}`);
  console.log(`Entries: ${current.counts.total}`);
  console.log(`Status counts: active=${current.counts.active}, candidate=${current.counts.candidate}, demoted=${current.counts.demoted}, archived=${current.counts.archived}`);
}

function handleBrainDedupe(workspace, flags, positional) {
  const scope = flags.scope || positional[0] || 'all';
  const report = buildBrainDedupeReport(workspace, scope);
  console.log(renderBrainDedupeReport(report));
}

function handleBrainList(workspace, flags, positional) {
  const scope = flags.scope || positional[0] || 'all';
  const report = queryBrainEntries(workspace, '', { scope, list: true });
  console.log('[BRAIN LIST]');
  console.log(`Scope: ${scope}`);
  console.log(`Entries: ${report.matches.length}`);
  for (const match of report.matches.slice(0, 20)) {
    console.log(`- [${match.status}] ${match.title} (${match.scope}, ${match.source}, ${match.confidence})`);
  }
}

function writeTrainingRecord(workspace, report) {
  const current = {
    kind: report.kind,
    version: report.version,
    mode: report.mode,
    outcome: report.outcome,
    activeProfile: report.activeProfile,
    activeHost: report.activeHost,
    focus: report.focus,
    language: report.language,
    sessionId: report.sessionId,
    generatedAt: report.generatedAt,
    summaryPath: path.relative(workspace.repoRoot, report.summaryPath),
    agents: report.agents.map((agent) => ({
      title: agent.title,
      role: agent.role,
      domain: agent.domain,
    })),
    lesson: report.lesson,
    luauLesson: report.luauLesson,
  };
  fs.mkdirSync(path.dirname(workspace.trainingCurrentPath), { recursive: true });
  fs.writeFileSync(workspace.trainingCurrentPath, JSON.stringify(current, null, 2) + '\n', 'utf8');

  const history = readTrainingHistory(workspace);
  const historyEntry = {
    ...current,
    eventType: report.mode,
    recordedAt: report.generatedAt,
    sequence: history.length + 1,
  };
  fs.mkdirSync(path.dirname(workspace.trainingHistoryPath), { recursive: true });
  fs.appendFileSync(workspace.trainingHistoryPath, JSON.stringify(historyEntry) + '\n', 'utf8');
  captureBrainFromTraining(workspace, report);
}

function readTrainingCurrent(workspace) {
  if (!fs.existsSync(workspace.trainingCurrentPath)) {
    return {
      kind: 'agent-system-training',
      version: 1,
      mode: 'idle',
      outcome: 'idle',
      activeProfile: workspace.activeProfileName,
      activeHost: workspace.activeHostName,
      focus: 'general',
      language: 'general',
      sessionId: '',
      generatedAt: '',
      summaryPath: '',
      agents: [],
      lesson: '',
      luauLesson: '',
    };
  }
  try {
    return readJson(workspace.trainingCurrentPath);
  } catch {
    return {
      kind: 'agent-system-training',
      version: 1,
      mode: 'idle',
      outcome: 'idle',
      activeProfile: workspace.activeProfileName,
      activeHost: workspace.activeHostName,
      focus: 'general',
      language: 'general',
      sessionId: '',
      generatedAt: '',
      summaryPath: '',
      agents: [],
      lesson: '',
      luauLesson: '',
    };
  }
}

function readTrainingHistory(workspace) {
  if (!fs.existsSync(workspace.trainingHistoryPath)) {
    return [];
  }
  const entries = [];
  const lines = fs.readFileSync(workspace.trainingHistoryPath, 'utf8').split(/\r?\n/);
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

function replaceMarkedBlock(sourceText, startMarker, endMarker, block) {
  const startToken = `<!-- ${startMarker} -->`;
  const endToken = `<!-- ${endMarker} -->`;
  const existingStart = sourceText.indexOf(startToken);
  const existingEnd = sourceText.indexOf(endToken);
  const nextBlock = String(block || '').trimEnd();
  if (existingStart !== -1 && existingEnd !== -1 && existingEnd > existingStart) {
    const before = sourceText.slice(0, existingStart).trimEnd();
    const after = sourceText.slice(existingEnd + endToken.length).trimStart();
    return [before, nextBlock, after].filter(Boolean).join('\n\n').trimEnd() + '\n';
  }
  const current = String(sourceText || '').trimEnd();
  if (!current) {
    return `${nextBlock}\n`;
  }
  return `${current}\n\n${nextBlock}\n`;
}

function buildUpgradeReport(workspace, sourceText, targetPath, activeHost) {
  const parsedSections = parseUpgradeAgentSections(sourceText);
  const sourceSections = parsedSections.length > 0 ? parsedSections : inferProfileUpgradeAgents(workspace.profile);
  const agents = sourceSections.map((section) => buildUpgradeAgent(section, workspace, activeHost));
  const hosts = Array.from(new Set(workspace.profile?.supportedHosts || ['claude', 'codex', 'qwen']));
  return {
    targetPath,
    profile: workspace.activeProfileName,
    activeHost,
    generatedAt: new Date().toISOString(),
    sections: sourceSections,
    agents,
    hosts,
  };
}

function parseUpgradeAgentSections(sourceText) {
  const lines = String(sourceText || '').split(/\r?\n/);
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (current) sections.push(current);
      current = { heading: line.trim(), body: [line] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) sections.push(current);
  return sections.filter((section) => /agent/i.test(section.heading));
}

function inferProfileUpgradeAgents(profile) {
  const entries = [];
  for (const ownedDomain of profile?.ownedDomains || []) {
    if (ownedDomain?.owner) {
      entries.push({
        heading: `${humanize(ownedDomain.owner)} (${ownedDomain.domain})`,
        body: [ownedDomain.notes || ''],
      });
    }
  }
  return entries;
}

function buildUpgradeAgent(section, workspace, syncHost) {
  const title = normalizeUpgradeHeading(section.heading);
  return {
    heading: section.heading,
    title,
    notes: upgradeNotesForTitle(title, section.body.join('\n'), workspace, syncHost),
  };
}

function normalizeUpgradeHeading(heading) {
  return String(heading || '')
    .replace(/^##\s+/, '')
    .replace(/^Agent\s+\d+\s+—\s+/i, '')
    .replace(/^The\s+/i, '')
    .trim();
}

function upgradeNotesForTitle(title, body, workspace, syncHost) {
  const lowered = `${title} ${body}`.toLowerCase();
  const hostName = normalizeHostName(syncHost || workspace.activeHostName);
  const base = [];

  if (lowered.includes('scriptmaster') || lowered.includes('logic')) {
    base.push('Keep selector, dispatcher, and recovery ownership explicit.');
    base.push('Preserve baseline and regression proof for existing-script updates.');
    base.push('Call out post-autoload runtime re-sync when derived state changes.');
  } else if (lowered.includes('ui designer') || lowered.includes('ui')) {
    base.push('Keep visible wording, ToolTip coverage, and gated visibility aligned.');
    base.push('Use status labels that match the user-facing intent first.');
    base.push('Document old -> new flag mappings when UI labels move.');
  } else if (lowered.includes('feature framer') || lowered.includes('framing')) {
    base.push('Make child controls read like subordinate actions, modes, or fallbacks.');
    base.push('Do not force separate product names for dependent controls.');
    base.push('Preserve the parent-child mental model in the visible wording.');
  } else if (lowered.includes('terminology keeper') || lowered.includes('terminology')) {
    base.push('Keep visible names stable across pages for the same concept.');
    base.push('Reject GPT-like labels that sound generic or inflated.');
    base.push('Only introduce synonyms when they improve comprehension.');
  } else if (lowered.includes('optimizer') || lowered.includes('performance')) {
    base.push('Keep register pressure, memory churn, and connection cleanup in view.');
    base.push('Avoid decorative helper layers that do not reduce risk or cost.');
    base.push('State ownership must remain explicit for long-lived loops.');
  } else if (lowered.includes('qa inspector') || lowered.includes('regression')) {
    base.push('Anchor delivery on a baseline and a clear regression matrix.');
    base.push('Call out touched vs untouched paths before delivery closes.');
    base.push('Block on missing proof instead of soft-approving the change.');
  } else if (lowered.includes('executor specialist') || lowered.includes('compat')) {
    base.push('Fail closed on unsupported executor paths.');
    base.push('Keep compatibility gates and unsupported-path notes explicit.');
    base.push('Do not assume host-native features exist without proof.');
  } else if (lowered.includes('lifecycle manager') || lowered.includes('lifecycle')) {
    base.push('Preserve rebinds, respawn paths, and loop ownership boundaries.');
    base.push('Never leave long-lived state without an owner contract.');
    base.push('Keep recovery and attachment paths explicit.');
  } else if (lowered.includes('update steward') || lowered.includes('update')) {
    base.push('Preserve the allowed update scope and preserve-list features.');
    base.push('Keep additive changes inside the existing owner path first.');
    base.push('State the old -> new runtime map when ownership moves.');
  } else if (lowered.includes('ghost') || lowered.includes('sentinel')) {
    base.push('Keep timing profiles concrete and suspicion response explicit.');
    base.push('Do not stack redundant background controllers.');
    base.push('Stop the line on remote timing or crash risk.');
  } else {
    base.push('Keep ownership explicit.');
    base.push('Capture the durable lesson in the right host memory.');
    base.push('Prefer additive, reversible upgrades over broad rewrites.');
  }

  base.push(`Host sync target: ${hostName}.`);
  return base;
}

function renderUpgradeSyncDoc(sourceText, report) {
  const start = '<!-- agent-system-upgrade-start -->';
  const end = '<!-- agent-system-upgrade-end -->';
  const lines = [];
  lines.push(start);
  lines.push('## Upgrade Sync');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Profile: ${report.profile}`);
  lines.push(`Host focus: ${report.activeHost}`);
  lines.push(`Agents upgraded: ${report.agents.length}`);
  lines.push('');
  for (const agent of report.agents) {
    lines.push(`### ${agent.title}`);
    for (const note of agent.notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }
  lines.push('### Host Sync');
  for (const host of report.hosts) {
    lines.push(`- ${host}: memory and instructions synced from the same upgrade pass.`);
  }
  lines.push(end);
  const block = lines.join('\n').trimEnd();
  const existingStart = sourceText.indexOf(start);
  const existingEnd = sourceText.indexOf(end);
  if (existingStart !== -1 && existingEnd !== -1 && existingEnd > existingStart) {
    const before = sourceText.slice(0, existingStart).trimEnd();
    const after = sourceText.slice(existingEnd + end.length).trimStart();
    return [before, block, after].filter(Boolean).join('\n\n').trimEnd() + '\n';
  }
  return `${String(sourceText || '').trimEnd()}\n\n${block}\n`;
}

function syncUpgradeMemory(workspace, report) {
  const profileName = workspace.activeProfileName;
  const profileMemoryPath = path.join(workspace.repoRoot, workspace.profile?.memory?.profileMemory || `memory/profile/${profileName}.md`);
  const profileMemoryText = renderUpgradeMemoryBlock('profile', profileName, report);
  fs.mkdirSync(path.dirname(profileMemoryPath), { recursive: true });
  fs.writeFileSync(profileMemoryPath, mergeUpgradeMemory(fs.existsSync(profileMemoryPath) ? fs.readFileSync(profileMemoryPath, 'utf8') : '', profileMemoryText), 'utf8');

  for (const host of report.hosts) {
    const hostPath = resolveHostMemoryPath(workspace.repoRoot, host, 'host');
    fs.mkdirSync(path.dirname(hostPath), { recursive: true });
    const existing = fs.existsSync(hostPath) ? fs.readFileSync(hostPath, 'utf8') : '';
    fs.writeFileSync(hostPath, mergeUpgradeMemory(existing, renderUpgradeMemoryBlock('host', host, report, host)), 'utf8');
  }
  captureBrainFromUpgrade(workspace, report);
}

function renderUpgradeMemoryBlock(scope, name, report, syncHost = report.activeHost) {
  const lines = [];
  lines.push('<!-- agent-system-upgrade-start -->');
  lines.push(`# Agent Upgrade Sync`);
  lines.push('');
  lines.push(`Scope: ${scope}`);
  lines.push(`Name: ${name}`);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Agents upgraded: ${report.agents.length}`);
  lines.push('');
  for (const section of report.sections || []) {
    const title = normalizeUpgradeHeading(section.heading);
    const notes = upgradeNotesForTitle(title, section.body.join('\n'), { activeHostName: syncHost }, syncHost);
    lines.push(`## ${title}`);
    for (const note of notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }
  lines.push('<!-- agent-system-upgrade-end -->');
  return lines.join('\n').trimEnd() + '\n';
}

function mergeUpgradeMemory(existingText, block) {
  const start = '<!-- agent-system-upgrade-start -->';
  const end = '<!-- agent-system-upgrade-end -->';
  const existingStart = existingText.indexOf(start);
  const existingEnd = existingText.indexOf(end);
  if (existingStart !== -1 && existingEnd !== -1 && existingEnd > existingStart) {
    const before = existingText.slice(0, existingStart).trimEnd();
    const after = existingText.slice(existingEnd + end.length).trimStart();
    return [before, block.trimEnd(), after].filter(Boolean).join('\n\n').trimEnd() + '\n';
  }
  const header = existingText.trimEnd();
  if (!header) {
    return block;
  }
  return `${header}\n\n${block}`;
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

function handleBackup(workspace, flags, positional) {
  const profileName = flags.profile || workspace.activeProfileName;
  const hostName = normalizeHostName(flags.host || workspace.activeHostName);
  const bundle = buildBackupBundle(workspace, profileName, hostName);
  const defaultOutput = workspace.manifest.backup?.defaultOutput || `${profileName}-backup.json`;
  const outputPath = positional[0] || path.join(workspace.repoRoot, defaultOutput);
  fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
  console.log(`Backed up ${profileName} to ${outputPath}`);
}

function handleRestore(workspace, flags, positional) {
  const inputPath = flags.files?.[0] || positional[0];
  if (!inputPath) {
    console.error('Usage: agent-system restore --file <bundle.json>');
    process.exit(1);
  }
  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.resolve(workspace.repoRoot, inputPath);
  const bundle = readJson(absolutePath);
  const validation = validateBackupBundle(bundle, workspace.repoRoot);
  if (!validation.ok) {
    console.log(renderBackupValidation(validation));
    process.exit(1);
  }

  let restored;
  try {
    restored = restoreBackupBundle(workspace.repoRoot, bundle);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  const restoredWorkspace = loadWorkspace(restored.profileName, restored.activeHost);
  const lint = buildLintReport(restoredWorkspace);
  if (!lint.ok) {
    console.log(renderBackupValidation(validation));
    console.log('[RESTORE LINT]');
    for (const item of lint.items) {
      console.log(`- ${item}`);
    }
    process.exit(1);
  }

  console.log(`Restored ${restored.profileName} to ${workspace.repoRoot}`);
}

function handleBundle(workspace, flags, positional) {
  const action = positional[0];
  const inputPath = flags.files?.[0] || positional[1];
  if (!action) {
    console.error('Usage: agent-system bundle <validate|diff|prune> --file <bundle.json>');
    process.exit(1);
  }
  if (!inputPath) {
    console.error('Usage: agent-system bundle <validate|diff|prune> --file <bundle.json>');
    process.exit(1);
  }

  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.resolve(workspace.repoRoot, inputPath);
  const bundle = readJson(absolutePath);

  switch (action) {
    case 'validate': {
      const report = validateBackupBundle(bundle, workspace.repoRoot);
      console.log(renderBackupValidation(report));
      process.exit(report.ok ? 0 : 1);
    }
    case 'diff': {
      const report = diffBackupBundle(workspace.repoRoot, bundle);
      console.log(renderBackupDiff(report));
      return;
    }
    case 'prune': {
      const report = pruneBackupBundle(bundle);
      fs.writeFileSync(absolutePath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
      console.log(renderBackupPrune(report, absolutePath));
      return;
    }
    default:
      console.error(`Unknown bundle action: ${action}`);
      process.exit(1);
  }
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

function printRouteSummary(workspace, taskText, explain = false) {
  const quickFixCandidate = !String(taskText || '').trim() ? detectQuickFixCandidate(workspace.repoRoot) : null;
  if (quickFixCandidate) {
    printQuickFixRouteSummary(quickFixCandidate, explain);
    return;
  }
  const profile = workspace.profile;
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

function printQuickFixRouteSummary(candidate, explain = false) {
  console.log('[QUICK ROUTE]');
  console.log(`Type: quick-fix`);
  console.log(`Target: ${candidate.target}`);
  if (isLuauQuickFile(candidate.target)) {
    console.log(`Language: Luau`);
    console.log(`Luau target: yes`);
  }
  console.log(`Agent: ${candidate.agent}`);
  console.log(`Skill: ${candidate.skill}`);
  console.log(`Checks: ${candidate.checks.join(', ')}`);
  if (explain) {
    console.log(`Why: ${candidate.reason}`);
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
    ['backup schema exists', () => fs.existsSync(path.join(workspace.repoRoot, workspace.manifest.backup?.schema || 'docs/backup-schema.md'))],
    ['change snapshot exists', () => fs.existsSync(workspace.changeCurrentPath)],
    ['change history exists', () => fs.existsSync(workspace.changeHistoryPath)],
    ['change readme exists', () => fs.existsSync(workspace.changeReadmePath)],
    ['change template exists', () => fs.existsSync(workspace.changeTemplatePath)],
    ['change memory exists', () => fs.existsSync(workspace.changeMemoryPath) || hasAnyChangeMemoryFile(workspace.repoRoot)],
    ['training snapshot exists', () => fs.existsSync(workspace.trainingCurrentPath)],
    ['training history exists', () => fs.existsSync(workspace.trainingHistoryPath)],
    ['training readme exists', () => fs.existsSync(workspace.trainingReadmePath)],
    ['training schema exists', () => fs.existsSync(workspace.trainingSchemaPath)],
    ['training continuity snapshot exists', () => fs.existsSync(workspace.trainingContinuousPath)],
    ['training continuity history exists', () => fs.existsSync(workspace.trainingContinuousHistoryPath)],
    ['training continuity readme exists', () => fs.existsSync(workspace.trainingContinuousReadmePath)],
    ['training recovery readme exists', () => fs.existsSync(path.join(workspace.repoRoot, workspace.manifest.training?.recovery || 'docs/training/recovery', 'README.md'))],
    ['brain readme exists', () => fs.existsSync(workspace.brainReadmePath)],
    ['brain schema exists', () => fs.existsSync(workspace.brainSchemaPath)],
    ['brain current exists', () => fs.existsSync(workspace.brainCurrentPath)],
    ['brain history exists', () => fs.existsSync(workspace.brainHistoryPath)],
    ['eval snapshot exists', () => fs.existsSync(workspace.evalCurrentPath)],
    ['eval history exists', () => fs.existsSync(workspace.evalHistoryPath)],
    ['eval readme exists', () => fs.existsSync(workspace.evalReadmePath)],
    ['eval schema exists', () => fs.existsSync(workspace.evalSchemaPath)],
    ['upgrade readme exists', () => fs.existsSync(path.join(workspace.repoRoot, 'docs', 'upgrade', 'README.md'))],
    ['upgrade current exists', () => fs.existsSync(path.join(workspace.repoRoot, 'docs', 'upgrade', 'current.json'))],
    ['upgrade history exists', () => fs.existsSync(path.join(workspace.repoRoot, 'docs', 'upgrade', 'history.jsonl'))],
    ['upgrade sessions readme exists', () => fs.existsSync(path.join(workspace.repoRoot, 'docs', 'upgrade', 'sessions', 'README.md'))],
    ['luau repair readme exists', () => fs.existsSync(path.join(workspace.repoRoot, 'docs', 'luau', 'README.md'))],
    ['luau repair snapshot exists', () => fs.existsSync(path.join(workspace.repoRoot, 'docs', 'luau', 'current.json'))],
    ['luau repair history exists', () => fs.existsSync(path.join(workspace.repoRoot, 'docs', 'luau', 'history.jsonl'))],
    ['luau repair log exists', () => fs.existsSync(path.join(workspace.repoRoot, 'docs', 'luau', 'repair-log.md'))],
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

function buildBackupBundle(workspace, profileName, hostName) {
  const exportBundle = buildExportBundle(workspace, profileName);
  return {
    kind: 'agent-system-backup',
    backupVersion: 1,
    createdAt: exportBundle.exportedAt,
    activeProfile: profileName,
    activeHost: normalizeHostName(hostName || workspace.activeHostName),
    manifest: exportBundle.manifest,
    profile: exportBundle.profile,
    profileDoc: exportBundle.profileDoc,
    memory: exportBundle.memory,
    change: {
      current: readChangeCurrent(workspace),
      history: readChangeHistory(workspace),
    },
    status: {
      current: readStatusCurrent(workspace),
      events: readStatusEvents(workspace),
    },
    memoryIndex: exportBundle.memoryIndex,
    files: collectBackupFiles(workspace.repoRoot),
  };
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

function restoreBackupBundle(repoRoot, bundle) {
  const profileName = bundle?.activeProfile || bundle?.profile?.profile || bundle?.profile?.name || 'imported-profile';
  const activeHost = normalizeHostName(bundle?.activeHost || bundle?.host || process.env.AGENT_SYSTEM_HOST || 'qwen');
  const entries = bundle?.files && typeof bundle.files === 'object' ? bundle.files : {};
  if (Object.keys(entries).length === 0) {
    throw new Error('backup bundle missing file snapshots');
  }
  writeBackupEntries(repoRoot, entries);

  return { profileName, activeHost };
}

function validateBackupBundle(bundle, repoRoot = process.cwd()) {
  const issues = [];
  if (!bundle || typeof bundle !== 'object') {
    return { ok: false, issues: ['bundle is not an object'] };
  }
  if (bundle.kind !== 'agent-system-backup') issues.push('kind must be agent-system-backup');
  if (bundle.backupVersion !== 1) issues.push('backupVersion must be 1');
  if (!isFilled(bundle.activeProfile)) issues.push('activeProfile missing');
  if (!isFilled(bundle.activeHost)) issues.push('activeHost missing');
  if (!bundle.manifest || typeof bundle.manifest !== 'object') issues.push('manifest missing');
  if (!bundle.profile || typeof bundle.profile !== 'object') issues.push('profile missing');
  if (!isFilled(bundle.profileDoc)) issues.push('profileDoc missing');
  if (!bundle.memory || typeof bundle.memory !== 'object') issues.push('memory missing');
  if (!bundle.change || typeof bundle.change !== 'object') issues.push('change missing');
  if (!bundle.status || typeof bundle.status !== 'object') issues.push('status missing');
  if (!bundle.files || typeof bundle.files !== 'object') issues.push('files missing');

  const requiredFiles = [
    'agent-system.json',
    'package.json',
    'README.md',
    'AGENTS.md',
    'docs/backup-schema.md',
    'docs/baselines/agent-system.mjs.md',
    `profiles/${bundle.activeProfile || bundle.profile?.profile || 'imphub'}/profile.json`,
    `profiles/${bundle.activeProfile || bundle.profile?.profile || 'imphub'}/AGENTS.md`,
  ];
  for (const file of requiredFiles) {
    if (!Object.prototype.hasOwnProperty.call(bundle.files || {}, file)) {
      issues.push(`missing file snapshot: ${file}`);
    }
  }

  if (!bundle.change?.current || typeof bundle.change.current !== 'object') issues.push('change.current missing');
  if (!Array.isArray(bundle.change?.history)) issues.push('change.history missing');
  if (!bundle.status?.current || typeof bundle.status.current !== 'object') issues.push('status.current missing');
  if (!Array.isArray(bundle.status?.events)) issues.push('status.events missing');

  const manifestPath = path.join(repoRoot, 'agent-system.json');
  if (fs.existsSync(manifestPath) && bundle.files?.['agent-system.json'] && typeof bundle.files['agent-system.json'] === 'object') {
    if (normalizeNewlines(JSON.stringify(bundle.files['agent-system.json'].value || {}, null, 2)) !== normalizeNewlines(JSON.stringify(readJson(manifestPath), null, 2))) {
      issues.push('manifest snapshot does not match current repo manifest');
    }
  }

  return { ok: issues.length === 0, issues };
}

function diffBackupBundle(repoRoot, bundle) {
  const currentProfile = readCurrentProfileName(repoRoot);
  const currentHost = normalizeHostName(process.env.AGENT_SYSTEM_HOST || 'qwen');
  const changed = [];
  const currentFiles = collectBackupFiles(repoRoot);
  const bundleFiles = bundle?.files && typeof bundle.files === 'object' ? bundle.files : {};

  if ((bundle.activeProfile || bundle.profile?.profile || '') !== currentProfile) {
    changed.push(`profile: ${currentProfile} -> ${bundle.activeProfile || bundle.profile?.profile || 'unknown'}`);
  }
  if ((bundle.activeHost || bundle.host || '') !== currentHost) {
    changed.push(`host: ${currentHost} -> ${bundle.activeHost || bundle.host || 'unknown'}`);
  }

  const fileNames = new Set([...Object.keys(currentFiles), ...Object.keys(bundleFiles)]);
  for (const file of fileNames) {
    const currentText = normalizeBackupEntryText(currentFiles[file]);
    const bundleText = normalizeBackupEntryText(bundleFiles[file]);
    if (currentText !== bundleText) {
      changed.push(`file: ${file}`);
    }
  }

  return { profileName: bundle.activeProfile || bundle.profile?.profile || 'unknown', changed };
}

function pruneBackupBundle(bundle) {
  let pruned = 0;
  const touched = [];
  const pruneField = (container, key) => {
    if (!container || typeof container[key] !== 'string') return;
    const next = pruneMarkdownBullets(container[key]);
    if (next !== container[key]) {
      container[key] = next;
      pruned += 1;
      touched.push(key);
    }
  };

  pruneField(bundle.memory, 'system');
  pruneField(bundle.memory, 'profile');
  pruneField(bundle.memory, 'change');
  pruneField(bundle.memory, 'packs');
  for (const host of Object.keys(bundle.memory?.host || {})) {
    pruneField(bundle.memory.host, host);
  }
  pruneField(bundle, 'profileDoc');
  pruneField(bundle.change, 'history');
  pruneField(bundle.status, 'events');

  if (bundle.files && typeof bundle.files === 'object') {
    for (const [file, entry] of Object.entries(bundle.files)) {
      if (typeof entry === 'string') {
        const next = pruneMarkdownBullets(entry);
        if (next !== entry) {
          bundle.files[file] = next;
          pruned += 1;
          touched.push(file);
        }
      }
    }
  }

  return { pruned, touched };
}

function renderBackupValidation(report) {
  const lines = [];
  lines.push('[BUNDLE VALIDATE]');
  lines.push(`Ready: ${report.ok ? 'yes' : 'no'}`);
  if (report.issues.length > 0) {
    lines.push('Issues:');
    for (const issue of report.issues) {
      lines.push(`- ${issue}`);
    }
  }
  return lines.join('\n');
}

function renderBackupDiff(report) {
  const lines = [];
  lines.push('[BUNDLE DIFF]');
  lines.push(`Profile: ${report.profileName}`);
  lines.push(`Changed: ${report.changed.length}`);
  for (const item of report.changed) {
    lines.push(`- ${item}`);
  }
  return lines.join('\n');
}

function renderBackupPrune(report, filePath) {
  const lines = [];
  lines.push('[BUNDLE PRUNE]');
  lines.push(`Wrote: ${filePath}`);
  lines.push(`Pruned: ${report.pruned}`);
  if (report.touched.length > 0) {
    lines.push('Touched:');
    for (const item of report.touched) {
      lines.push(`- ${item}`);
    }
  }
  return lines.join('\n');
}

function collectBackupFiles(repoRoot) {
  const include = [];
  for (const file of walkFiles(repoRoot)) {
    if (!shouldIncludeBackupFile(repoRoot, file)) continue;
    include.push(path.relative(repoRoot, file));
  }
  include.sort((left, right) => left.localeCompare(right));
  const files = {};
  for (const relative of include) {
    files[relative] = serializeBackupEntry(path.join(repoRoot, relative));
  }
  return files;
}

function shouldIncludeBackupFile(repoRoot, filePath) {
  const relative = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  if (!relative || relative.startsWith('.git/') || relative === '.git') return false;
  if (relative.startsWith('node_modules/') || relative.startsWith('.worktrees/')) return false;
  if (/-backup\.json$/i.test(relative)) return false;
  return true;
}

function serializeBackupEntry(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.json')) {
    return { kind: 'json', value: JSON.parse(text) };
  }
  return text;
}

function writeBackupEntries(repoRoot, entries) {
  for (const [relative, entry] of Object.entries(entries)) {
    const targetPath = path.join(repoRoot, relative);
    if (entry === null) {
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { force: true });
      }
      continue;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (entry && typeof entry === 'object' && entry.kind === 'json') {
      fs.writeFileSync(targetPath, JSON.stringify(entry.value, null, 2) + '\n', 'utf8');
    } else if (entry && typeof entry === 'object' && typeof entry.text === 'string') {
      fs.writeFileSync(targetPath, entry.text, 'utf8');
    } else if (typeof entry === 'string') {
      fs.writeFileSync(targetPath, entry, 'utf8');
    }
  }
}

function normalizeBackupEntryText(entry) {
  if (typeof entry === 'string') return normalizeNewlines(entry);
  if (entry && typeof entry === 'object' && entry.kind === 'json') {
    return normalizeNewlines(JSON.stringify(entry.value, null, 2));
  }
  if (entry && typeof entry === 'object' && typeof entry.text === 'string') {
    return normalizeNewlines(entry.text);
  }
  return '';
}

function readCurrentProfileName(repoRoot) {
  const manifest = readJson(path.join(repoRoot, 'agent-system.json'));
  return manifest.profileDiscovery?.defaultProfile || 'imphub';
}

function pruneMarkdownBullets(text) {
  const lines = String(text || '').split(/\r?\n/);
  const seen = new Set();
  const output = [];
  for (const line of lines) {
    const normalized = line.trim();
    if (!normalized) {
      output.push(line);
      continue;
    }
    if (normalized.startsWith('- ')) {
      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
    }
    output.push(line);
  }
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
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
        const key = normalizeMemoryBullet(normalized);
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
  captureBrainFromChange(workspace, current, eventType);
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
