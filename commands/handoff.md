---
description: Emit a HANDOFF block for the current owner stage
---

Use the active profile and current stage context to emit a valid `[HANDOFF]`.

If the handoff depends on `upgrade replay`, `brain dedupe`, or `delivery-check`, name the wrapper that owns the proof trail.

Requirements:

- state what changed
- state what is now locked and must not be silently rewritten
- call out open risks
- name the next agent or next review stage
- include a proof target and regression impact note

Stage context:
{{args}}
