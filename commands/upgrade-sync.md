---
description: Reapply the stored upgrade state without re-inference
---

Use `upgrade sync` to materialize the learned upgrade state again.

Requirements:

- read `docs/upgrade/current.json`
- reapply the stored upgrade result without re-inferring lessons
- keep the sync idempotent
- fail closed if the upgrade state does not exist

Upgrade input:
{{args}}
