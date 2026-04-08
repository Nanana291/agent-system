import fs from 'node:fs';
import path from 'node:path';

function resolveProfileMemoryPath(workspace) {
  return path.join(
    workspace.repoRoot,
    workspace.profile?.memory?.profileMemory || `memory/profile/${workspace.activeProfileName}.md`,
  );
}

function artifactLabel(filePath, workspace) {
  const relative = path.relative(workspace.repoRoot, filePath).replaceAll(path.sep, '/');
  const profileRelative = path.relative(workspace.repoRoot, resolveProfileMemoryPath(workspace)).replaceAll(path.sep, '/');
  if (relative === 'docs/upgrade/current.json') return 'upgrade current';
  if (relative === 'docs/upgrade/history.jsonl') return 'upgrade history';
  if (relative === 'docs/upgrade/sessions/README.md') return 'upgrade sessions readme';
  if (relative === 'docs/brain/current.json') return 'brain current';
  if (relative === 'docs/brain/history.jsonl') return 'brain history';
  if (relative === 'docs/training/current.json') return 'training current';
  if (relative === 'docs/training/history.jsonl') return 'training history';
  if (relative === 'change/current.json') return 'change current';
  if (relative === 'change/history.jsonl') return 'change history';
  if (relative === 'status/current.json') return 'status current';
  if (relative === 'status/events.jsonl') return 'status events';
  if (relative === profileRelative) {
    return 'profile memory';
  }
  if (relative.startsWith('memory/host/')) {
    return `${path.basename(relative, '.md')} host memory`;
  }
  if (relative.startsWith('memory/change/')) {
    return `${path.basename(relative, '.md')} change memory`;
  }
  if (relative.startsWith('memory/packs/')) {
    return `${path.basename(relative, '.md')} packs memory`;
  }
  return relative.replaceAll('/', ' ');
}

export function validateDeliveryArtifacts(workspace) {
  const requiredFiles = [
    workspace.brainCurrentPath,
    workspace.brainHistoryPath,
    workspace.trainingCurrentPath,
    workspace.trainingHistoryPath,
    workspace.changeCurrentPath,
    workspace.changeHistoryPath,
    workspace.statusCurrentPath,
    workspace.statusEventsPath,
    path.join(workspace.repoRoot, 'docs', 'upgrade', 'current.json'),
    path.join(workspace.repoRoot, 'docs', 'upgrade', 'history.jsonl'),
    path.join(workspace.repoRoot, 'docs', 'upgrade', 'sessions', 'README.md'),
    workspace.hostMemoryPath,
    workspace.changeMemoryPath,
    workspace.packMemoryPath,
    resolveProfileMemoryPath(workspace),
    workspace.profilePath,
    workspace.profileDocPath,
  ];

  const missing = requiredFiles
    .filter((filePath) => !fs.existsSync(filePath))
    .map((filePath) => artifactLabel(filePath, workspace));

  return {
    ok: missing.length === 0,
    missing,
  };
}

export function buildDeliveryGateReport(workspace) {
  const validation = validateDeliveryArtifacts(workspace);
  const ready = validation.ok;
  const missing = validation.missing;

  return {
    baselineUpdated: ready ? 'yes' : 'no',
    regressionMatrix: ready ? 'yes' : 'no',
    oldToNewMapping: ready ? 'yes' : 'no',
    ownedDomainsClosed: ready ? 'yes' : 'no',
    openRisks: missing.length > 0 ? missing.map((item) => `missing ${item}`) : ['none'],
    blockedOrReady: ready ? 'Ready' : 'Blocked',
  };
}

export function renderDeliveryGate(report) {
  return [
    '[DELIVERY GATE]',
    `Baseline updated: ${report.baselineUpdated}`,
    `Regression matrix: ${report.regressionMatrix}`,
    `Old->new mapping: ${report.oldToNewMapping}`,
    `Owned domains closed: ${report.ownedDomainsClosed}`,
    `Open risks: ${report.openRisks.join(', ')}`,
    `Blocked / Ready: ${report.blockedOrReady}`,
  ].join('\n');
}
