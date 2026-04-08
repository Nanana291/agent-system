---
description: Compare a historical upgrade session against the current target
---

Use `upgrade replay` to validate that a prior upgrade lesson still applies.

Requirements:

- accept a historical session reference through `--source`
- compare the stored lesson against the current target
- report drift instead of promoting stale guidance
- avoid writing docs or memory during replay

Upgrade input:
{{args}}
