# OpenCode Adapter

This adapter is the OpenCode bootstrap path for `agent-system`.

## Responsibility

- Load `agent-system.json` first.
- Prefer the repo-local OpenCode tool surface in `.opencode/tools/agent_system.ts`.
- Keep the same manifest and profile contracts used by Claude Code, Codex, and Qwen Code.
- Fall back to the markdown docs plus `bin/agent-system.mjs` when richer OpenCode tooling is unavailable.

## Operating model

- OpenCode loads local tools from `.opencode/tools/` at startup.
- `.opencode/package.json` gives OpenCode the helper dependency for the custom tool definitions.
- The tools are thin wrappers over the existing `agent-system` CLI, so they stay aligned with the repo contract.
