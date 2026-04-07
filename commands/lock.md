---
description: Emit a TASK LOCK using the active profile and selected route
---

Use the active profile and task details to emit a valid `[TASK LOCK]`.

Requirements:

- do not invent agents outside the selected profile route
- include the selected process skill if known, otherwise state `unspecified`
- include all change-classification tags that materially apply
- keep stop-line risks specific to the route and target

Task input:
{{args}}
