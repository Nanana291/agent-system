# Qwen Code Adapter

This adapter is the Qwen Code bootstrap path for `agent-system`.

## Responsibility

- Load `agent-system.json` first.
- Use `QWEN.md` and `.qwen/INSTALL.md` as the host bootstrap files.
- Prefer profile data in `profiles/<profile>/profile.json` and `profiles/<profile>/AGENTS.md`.
- Keep Superpowers in the process layer and Agent System in the route/ownership layer.

## Operating model

- If Qwen Code can load repo markdown directly, use the root docs plus the active profile docs.
- If a richer integration is available, map it to the same manifest paths instead of creating a separate contract.
- If a capability is missing, fall back to the markdown artifacts and keep the manifest authoritative.
