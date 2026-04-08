---
description: Emit the brain dedupe contract and list merge candidates
---

Use the active profile and current brain state to emit a valid `[BRAIN DEDUPE]`.

Requirements:

- list merge candidates deterministically
- call out the scope and total candidate count
- avoid mutating the brain unless the caller explicitly asks for apply mode

Brain input:
{{args}}
