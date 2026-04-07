# Codex Install

Use this repository from the repo root and treat `agent-system.json` as the authority for routing and artifact paths.

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
