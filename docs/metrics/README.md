# Metrics Trail

`docs/metrics/` stores the materialized workspace metrics trail.

- `docs/metrics/current.json` is the latest snapshot.
- `docs/metrics/history.jsonl` is the append-only snapshot log.
- `docs/metrics/snapshots/` stores immutable point-in-time captures.

The `metrics`, `metrics trend`, and `metrics compare` commands read this trail, while `train` and `upgrade` append new snapshots after successful runs.
