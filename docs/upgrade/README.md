# Upgrade Log

This directory stores the learning-aware `/upgrade` pipeline.

## Files

- `current.json` holds the latest upgrade learning state.
- `history.jsonl` stores append-only upgrade runs.
- `sessions/<session>.md` stores one human-readable summary per upgrade session.

## Policy

- `upgrade preview` inspects the target without writing files.
- `upgrade learn` records per-agent lessons and the durable upgrade snapshot.
- `upgrade apply` writes the learned sync into docs and memory.
- `upgrade sync` rehydrates the stored upgrade state without re-inference.
- `upgrade report` prints the latest upgrade learning state.
- `upgrade status` is a read-only alias for the latest upgrade learning state.
- `upgrade replay` compares a historical upgrade session against the current target.
