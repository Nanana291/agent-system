---
description: Show or capture the workspace metrics trail
---

Use `metrics` to inspect the current workspace metrics summary.

Requirements:

- read `docs/metrics/current.json` for the current snapshot
- fail closed if the metrics trail does not exist yet
- keep the summary aligned with the append-only `docs/metrics/history.jsonl` trail

Metrics input:
{{args}}
