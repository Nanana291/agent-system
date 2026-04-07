# Installing Agent System for Codex

Use this repository from the repo root and treat `agent-system.json` as the authority for routing and artifact paths.

## Quick Install

Tell Codex:

```text
Fetch and follow instructions from https://raw.githubusercontent.com/Nanana291/agent-system/refs/heads/main/.codex/INSTALL.md
```

## Manual Install

1. Clone the repo:

```bash
git clone https://github.com/Nanana291/agent-system.git ~/.codex/agent-system
```

2. Create the skills symlink:

```bash
mkdir -p ~/.agents/skills
ln -s ~/.codex/agent-system/skills ~/.agents/skills/agent-system
```

3. Restart Codex.

## Bootstrap

1. Open the repository root.
2. Read `README.md` and `AGENTS.md`.
3. Read this file for the Codex bootstrap contract.
4. Load the active profile from `profiles/<profile>/profile.json` and its companion `AGENTS.md`.

## Codex behavior

- Keep Superpowers in the process layer.
- Use Agent System for route selection, ownership, handoffs, and delivery gates.
- If a richer host integration is unavailable, work directly from the markdown artifacts.

## Failure mode

If Codex cannot materialize a command or subagent feature, emit the required artifact in the chat or file output and keep the manifest consistent.

## Updating

```bash
cd ~/.codex/agent-system && git pull
```
