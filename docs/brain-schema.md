# Brain Schema

The brain is event-sourced.

## Current State

`docs/brain/current.json` contains:

- `kind`: `agent-system-brain`
- `brainVersion`: `1`
- `activeProfile`
- `activeHost`
- `generatedAt`
- `updatedAt`
- `counts`
- `entries[]`

The current brain should preserve the timestamps and counters from the last real event so repeated reads do not create artificial churn.

## Event Log

`docs/brain/history.jsonl` appends:

- `kind`: `agent-system-brain-event`
- `brainVersion`: `1`
- `brainId`
- `source`
- `scope`
- `status`
- `confidence`
- `title`
- `summary`
- `facts[]`
- `tags[]`
- `relatedPaths[]`
- `evidence`
- `host`
- `profile`
- `createdAt`
- `updatedAt`
- `eventCount`
- `lastEvent`

## Snapshot

`brain snapshot` writes a portable bundle with:

- `kind`: `agent-system-brain-snapshot`
- `brainVersion`: `1`
- `createdAt`
- `activeProfile`
- `activeHost`
- `counts`
- `current`
- `history`
