---
description: Print the latest upgrade learning state and per-agent lesson summary
---

Use `upgrade report` to inspect the last upgrade state without writing files.

Requirements:

- show the target, host, session, and phase
- list each affected agent with status and lesson
- include learned, reinforced, and blocked counts
- avoid mutating docs or memory

Upgrade input:
{{args}}
