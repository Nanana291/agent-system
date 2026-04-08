# Upgrade History

This directory stores the materialized upgrade trail for `agent-system`.

## Files

- `current.json` stores the latest upgrade session snapshot.
- `history.jsonl` stores append-only upgrade events.
- `sessions/` stores one JSON session file per upgrade run.

## Policy

- `upgrade apply` writes the session trail before it returns.
- `upgrade sync` refreshes the materialized docs and rewrites the current session.
- `upgrade replay` compares the current docs against the latest session and blocks on drift.
- `delivery-check` requires the upgrade artifacts to exist before release closure.
