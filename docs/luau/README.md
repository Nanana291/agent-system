# Luau Repair Loop

This directory stores the Luau repair snapshot and the human-readable repair log used by `luau-repair`, `luau-gate`, `train`, and `eval`.

## Files

- `current.json` holds the latest Luau repair snapshot.
- `history.jsonl` stores append-only repair events.
- `repair-log.md` stores the latest readable repair summary.

## Policy

- `luau-explain` and `luau-diagnose` read the repair path before a repair is applied.
- `luau-repair` writes the snapshot, repair log, host memory, profile docs, and `AGENTS.md`.
- `luau-gate` blocks delivery until the repair snapshot is complete.
- `train` and `eval` auto-detect a ready Luau repair snapshot and reuse it as Luau learning context.
