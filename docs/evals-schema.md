# Evaluation Schema

`agent-system` uses this schema for the evaluation loop.

## Required Fields

- `kind`
- `version`
- `mode`
- `outcome`
- `activeProfile`
- `activeHost`
- `sessionId`
- `generatedAt`
- `threshold`
- `score`
- `verdict`
- `delta`
- `comparedTo`
- `promoted`
- `findings`
- `lessons`
- `summaryPath`

## Runtime Files

- `docs/evals/current.json`
- `docs/evals/history.jsonl`
- `docs/evals/<session>.md`

## Sync Rule

Evaluation sync blocks are identified by the `agent-system-eval-start` and `agent-system-eval-end` markers and must be replaced in place when the same evaluation route promotes again.

