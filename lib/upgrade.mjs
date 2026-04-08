import fs from 'node:fs';
import path from 'node:path';

function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function resolveUpgradeDir(workspace) {
  return path.join(workspace.repoRoot, 'docs', 'upgrade');
}

function resolveUpgradePaths(workspace) {
  const upgradeDir = resolveUpgradeDir(workspace);
  const sessionsDir = path.join(upgradeDir, 'sessions');
  return {
    upgradeDir,
    sessionsDir,
    readmePath: path.join(upgradeDir, 'README.md'),
    currentPath: path.join(upgradeDir, 'current.json'),
    historyPath: path.join(upgradeDir, 'history.jsonl'),
    sessionsReadmePath: path.join(sessionsDir, 'README.md'),
  };
}

function ensureTextFile(filePath, text) {
  if (fs.existsSync(filePath)) {
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, 'utf8');
}

export function ensureUpgradeWorkspace(workspace) {
  const paths = resolveUpgradePaths(workspace);
  fs.mkdirSync(paths.sessionsDir, { recursive: true });
  ensureTextFile(
    paths.readmePath,
    '# Upgrade History\n\nThis directory stores upgrade sessions, current state, and history entries for `agent-system`.\n',
  );
  ensureTextFile(
    paths.sessionsReadmePath,
    '# Upgrade Sessions\n\nEach upgrade run writes one session snapshot here so replay can compare against the last known state.\n',
  );
  return paths;
}

export function writeUpgradeSession(workspace, snapshot) {
  const paths = ensureUpgradeWorkspace(workspace);
  const sessionId = snapshot.sessionId;
  const sessionPath = path.join(paths.sessionsDir, `${sessionId}.json`);
  const current = {
    kind: 'agent-system-upgrade',
    version: 1,
    mode: snapshot.mode,
    outcome: snapshot.outcome,
    activeProfile: snapshot.activeProfile,
    activeHost: snapshot.activeHost,
    generatedAt: snapshot.generatedAt,
    sessionId,
    targetPath: snapshot.targetPath,
    profileDocPath: snapshot.profileDocPath,
    replaySource: snapshot.replaySource || '',
    targetText: snapshot.targetText,
    profileDocText: snapshot.profileDocText,
    sessionPath: path.relative(workspace.repoRoot, sessionPath),
    agents: snapshot.agents,
    hosts: snapshot.hosts,
    sections: snapshot.sections,
  };

  fs.writeFileSync(paths.currentPath, JSON.stringify(current, null, 2) + '\n', 'utf8');
  fs.appendFileSync(
    paths.historyPath,
    JSON.stringify({
      ...current,
      eventType: snapshot.mode,
      recordedAt: snapshot.generatedAt,
      sequence: readUpgradeHistory(paths.historyPath).length + 1,
    }) + '\n',
    'utf8',
  );
  fs.writeFileSync(sessionPath, JSON.stringify(current, null, 2) + '\n', 'utf8');
  return current;
}

export function readLatestUpgradeSession(workspace) {
  const paths = resolveUpgradePaths(workspace);
  if (!fs.existsSync(paths.currentPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(paths.currentPath, 'utf8'));
  } catch {
    return null;
  }
}

export function buildUpgradeReplayReport(workspace, hostName) {
  const latest = readLatestUpgradeSession(workspace);
  if (!latest) {
    return {
      ok: false,
      activeHost: hostName,
      sessionId: '',
      targetPath: 'AGENTS.md',
      profileDocPath: path.relative(workspace.repoRoot, workspace.profileDocPath),
      drift: ['upgrade current'],
      blockedOrReady: 'Blocked',
    };
  }

  const targetPath = path.isAbsolute(latest.targetPath)
    ? latest.targetPath
    : path.join(workspace.repoRoot, latest.targetPath);
  const profileDocPath = path.isAbsolute(latest.profileDocPath)
    ? latest.profileDocPath
    : path.join(workspace.repoRoot, latest.profileDocPath || workspace.profileDocPath);
  const targetText = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : '';
  const profileDocText = fs.existsSync(profileDocPath) ? fs.readFileSync(profileDocPath, 'utf8') : '';
  const drift = [];

  if (normalizeText(targetText) !== normalizeText(latest.targetText)) {
    drift.push(path.relative(workspace.repoRoot, targetPath));
  }
  if (normalizeText(profileDocText) !== normalizeText(latest.profileDocText)) {
    drift.push(path.relative(workspace.repoRoot, profileDocPath));
  }

  return {
    ok: drift.length === 0,
    activeHost: hostName,
    sessionId: latest.sessionId || '',
    targetPath: path.relative(workspace.repoRoot, targetPath),
    profileDocPath: path.relative(workspace.repoRoot, profileDocPath),
    drift,
    blockedOrReady: drift.length === 0 ? 'Ready' : 'Blocked',
  };
}

export function renderUpgradeReplayReport(report) {
  return [
    '[UPGRADE REPLAY]',
    `Host: ${report.activeHost}`,
    `Session: ${report.sessionId || 'none'}`,
    `Target: ${report.targetPath}`,
    `Profile doc: ${report.profileDocPath}`,
    `Drift: ${report.drift.join(', ') || 'none'}`,
    `Blocked / Ready: ${report.blockedOrReady}`,
  ].join('\n');
}

function readUpgradeHistory(historyPath) {
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
