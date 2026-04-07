# Backup Schema

`agent-system backup` writes a portable snapshot of the workspace into one JSON bundle.

## Top-level fields

- `kind`: must be `agent-system-backup`
- `backupVersion`: schema version, currently `1`
- `createdAt`: ISO timestamp for the snapshot
- `activeProfile`: profile name captured by the backup
- `activeHost`: host name captured by the backup
- `manifest`: the loaded `agent-system.json` content
- `profile`: the active `profiles/<profile>/profile.json` content
- `profileDoc`: the active `profiles/<profile>/AGENTS.md` content
- `memory`: host-scoped memory sections
- `change`: current change intake and history
- `status`: current presence snapshot and event log
- `memoryIndex`: summary counts from the live workspace
- `files`: full file snapshot map keyed by repo-relative path

## File snapshot rules

- JSON files are stored as objects with `kind: "json"` and a `value` payload.
- Markdown and text files are stored as raw strings.
- The bundle excludes `.git/`, `node_modules/`, `.worktrees/`, and generated backup files ending in `-backup.json`.

## Restore contract

- `agent-system restore --file <bundle.json>` writes the `files` map back to the workspace.
- The restore step is validated before write and then checked again with `validate` and `lint`.
- If the bundle is missing file snapshots or required metadata, restore fails closed.
