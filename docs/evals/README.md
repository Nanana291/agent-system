# Evaluation Log

This directory stores the automatic evaluation loop for `agent-system`.

## Files

- `current.json` holds the latest evaluation run state.
- `history.jsonl` stores append-only evaluation events.
- `<session>.md` stores one human-readable summary per run.

## Policy

- `eval simulate` and `eval score` record the score without promoting memory.
- `eval compare` records the delta against the latest evaluation run.
- `eval promote` writes the durable lesson into the active profile and host memory after the score clears the threshold.
- Luau repair snapshots automatically feed `eval` with Luau context after `luau-repair` runs.
