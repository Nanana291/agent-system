# OpenCode Bootstrap

Use this repo as an OpenCode project with local tools.

- OpenCode loads `.opencode/tools/agent_system.ts` automatically.
- `.opencode/package.json` provides the helper dependency for the custom tool definitions.
- The source of truth remains `agent-system.json` plus the active profile files.
- Prefer the OpenCode tools for common `agent-system` flows like `validate`, `route`, `upgrade status`, `delivery-check`, `brain query`, and `luau-train`.

If OpenCode cannot load the richer local tool surface, fall back to the markdown docs and CLI entrypoints in `bin/`.
