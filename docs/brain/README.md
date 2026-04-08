# Brain Store

This directory stores the structured second brain for `agent-system`.

## Files

- `current.json` stores the current materialized brain state.
- `history.jsonl` stores append-only brain events.
- `snapshots/` stores exported brain snapshots.

## Policy

- `brain add`, `brain promote`, `brain demote`, and `brain sync` keep the current state current.
- `brain query` and `brain explain` read the current brain without mutating it.
- `brain snapshot`, `brain restore`, and `brain diff` support portable recovery.
- Training, eval, change, upgrade, recovery, and memory flows feed the brain automatically.

