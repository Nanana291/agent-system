---
description: Emit the upgrade apply contract and create or refresh the upgrade session snapshot
---

Use the active profile and current upgrade target to emit a valid `[UPGRADE APPLY]`.

Requirements:

- create or refresh `docs/upgrade/current.json`
- append to `docs/upgrade/history.jsonl`
- write one session snapshot under `docs/upgrade/sessions/`
- call out the synced hosts and the target path
- end with a clear `Blocked` or `Ready`

Upgrade input:
{{args}}
