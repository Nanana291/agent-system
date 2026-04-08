---
description: Emit the upgrade sync contract for the current session
---

Use the active profile and current upgrade target to emit a valid `[UPGRADE SYNC]`.

Requirements:

- refresh the materialized upgrade docs and memory trail
- preserve the latest session trail under `docs/upgrade/`
- call out any missing proof or drift in the current docs
- end with a clear `Blocked` or `Ready`

Upgrade input:
{{args}}
