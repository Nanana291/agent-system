# Training Log

This directory stores the automatic training loop for `agent-system`.

## Files

- `current.json` holds the latest training run state.
- `history.jsonl` stores append-only training events.
- `<session>.md` stores one human-readable summary per run.
- `continuous.json` stores the latest continuous-training state.
- `continuous-history.jsonl` stores append-only continuous-training events.
- `continuous.md` stores the latest auditable continuous-training summary.
- `explain/<host>.jsonl` and `compare/<host>.jsonl` store host-separated audit trails for `train explain` and `train compare`.
- `packs/<host>.md` and `packs/<host>.json` store host training packs after enough continuous cycles accumulate.
- `recovery/<host>/latest.json`, `recovery/<host>/history.jsonl`, and `recovery/<host>/snapshots/<timestamp>.json` store host learning recovery snapshots.
- `docs/brain/current.json` and `docs/brain/history.jsonl` store the structured second brain that receives durable lessons from training and recovery flows.

## Policy

- `train` writes the sync block in place instead of appending duplicates.
- `train error` records prevention rules in the active host change memory.
- `train replay` reuses the latest lesson without creating a second sync block.
- `train explain` and `train compare` keep audit history separated by host.
- `train packs` reports the host training pack once enough continuous cycles have been recorded.
- `memory gate` can demote weak host lessons back into `memory/change/<host>.md` before promotion.
- `memory snapshot`, `memory restore`, `memory diff`, and `memory rollback` recover host learning state.
- `train rollback` restores the latest host learning snapshot after a bad pass.
- Luau repair snapshots automatically feed `train` with Luau context after `luau-repair` runs.
- Successful `train` cycles auto-promote durable lessons, refresh the host learning pack, and rewrite the continuous-training snapshot.
- Successful `train` cycles also feed the second brain so the same lesson can be queried, explained, or promoted later without rebuilding it from raw logs.
