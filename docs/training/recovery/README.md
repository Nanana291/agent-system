# Training Recovery

This directory stores host-scoped learning snapshots.

## Layout

- `latest.json` is the most recent snapshot for the host.
- `history.jsonl` appends snapshot metadata for auditability.
- `snapshots/<timestamp>.json` stores archived snapshot copies.

## Snapshot Contents

Snapshots capture the active host learning surface, including:

- `AGENTS.md`
- `profiles/<profile>/AGENTS.md`
- `memory/profile/<profile>.md`
- `memory/host/<host>.md`
- `memory/change/<host>.md`
- `memory/packs/<host>.md`
- `docs/training/current.json`
- `docs/training/continuous.json`
- `docs/training/continuous.md`
- `docs/training/packs/<host>.md`
- `docs/training/packs/<host>.json`
- `docs/training/explain/<host>.jsonl`
- `docs/training/explain/<host>.md`
- `docs/training/compare/<host>.jsonl`
- `docs/training/compare/<host>.md`

## Commands

- `agent-system memory snapshot --host <name>`
- `agent-system memory restore --file <snapshot.json>`
- `agent-system memory diff --file <snapshot.json>`
- `agent-system memory rollback --host <name>`
- `agent-system train rollback --host <name>`
