---
description: Learn per-agent upgrade lessons and persist the upgrade snapshot
---

Use `upgrade learn` to analyze the target and store the learned per-agent lessons.

Requirements:

- derive a lesson for each affected agent section
- persist the upgrade current snapshot
- append the upgrade history log
- keep docs and memory untouched until `upgrade apply` or `upgrade sync`

Upgrade input:
{{args}}
