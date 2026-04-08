---
description: Run the learning-aware upgrade pipeline for the active profile
---

Use `upgrade` when the repo contract or profile instructions need to be learned, applied, or replayed.

Core forms:

- `upgrade` runs the full learning-aware cycle
- `upgrade preview` inspects the target without writing files
- `upgrade learn` derives and persists per-agent lessons
- `upgrade apply` materializes the learned sync blocks
- `upgrade sync` reapplies the stored upgrade state
- `upgrade report` prints the latest upgrade learning state
- `upgrade status` is a read-only alias for the latest upgrade learning state
- `upgrade replay` compares a historical upgrade session
- `upgrade docs` rewrites only the agent/profile docs
- `upgrade profile` rewrites the active profile doc and profile memory
- `upgrade memory` rewrites only the profile and host memory layers
- `upgrade hosts` rewrites only the host memory layers

Upgrade input:
{{args}}
