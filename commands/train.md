---
description: Train multiple agents, inspect recent history, and sync training memory
---

Use `train` for the continuous learning loop.

Core forms:

- `train` runs the default training cycle
- `train error` records prevention rules
- `train review` reviews the latest host state
- `train replay` reuses the latest durable lesson
- `train promote` promotes durable lessons
- `train sync` rewrites the sync block without changing the focus
- `train status` prints the current training state, continuous state, and active host pack
- `train history` prints the recent training runs for the active host
- `train explain` writes a host audit trail that explains why the current lesson exists
- `train compare` writes a host audit trail that compares consecutive runs
- `train packs` lists or regenerates the host training pack
- `train rollback` restores the latest host learning snapshot

Training input:
{{args}}
