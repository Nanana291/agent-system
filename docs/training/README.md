# Training Log

This directory stores the automatic training loop for `agent-system`.

## Files

- `current.json` holds the latest training run state.
- `history.jsonl` stores append-only training events.
- `<session>.md` stores one human-readable summary per run.
- `continuous.json` stores the latest continuous-training state.
- `continuous-history.jsonl` stores append-only continuous-training events.
- `continuous.md` stores the latest auditable continuous-training summary.

## Policy

- `train` writes the sync block in place instead of appending duplicates.
- `train error` records prevention rules in the active host change memory.
- `train replay` reuses the latest lesson without creating a second sync block.
- Luau repair snapshots automatically feed `train` with Luau context after `luau-repair` runs.
- Successful `train` cycles auto-promote durable lessons, refresh the host learning pack, and rewrite the continuous-training snapshot.
