# Training Schema

`agent-system` uses this schema for the automatic training loop.

## Required Fields

- `kind`
- `version`
- `mode`
- `outcome`
- `activeProfile`
- `activeHost`
- `sessionId`
- `generatedAt`
- `summaryPath`
- `agents`
- `lesson`

## Runtime Files

- `docs/training/current.json`
- `docs/training/history.jsonl`
- `docs/training/<session>.md`

## Sync Rule

Training blocks are identified by the `agent-system-training-start` and `agent-system-training-end` markers and must be replaced in place when the same training route runs again.

