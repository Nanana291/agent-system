---
description: Emit the upgrade replay contract and compare the current docs against the last session
---

Use the active profile and current upgrade target to emit a valid `[UPGRADE REPLAY]`.

Requirements:

- compare the current docs against the latest upgrade session
- report drift explicitly when the files no longer match
- name the target path and session id
- end with a clear `Blocked` or `Ready`

Upgrade input:
{{args}}
