---
description: Emit a DELIVERY GATE block and decide whether the work is blocked or ready
---

Use the active profile and current artifacts to emit a valid `[DELIVERY GATE]`.

For workspace proof, prefer the executable `delivery-check` wrapper when you need the real blocked or ready state.

Requirements:

- call out missing baseline, regression matrix, or mapping artifacts when relevant
- state whether owned domains are closed
- list open risks explicitly
- end with a clear `Blocked` or `Ready`

Delivery context:
{{args}}
