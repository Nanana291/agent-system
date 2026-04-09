# agent-system 0.6.4.4 Metrics Spine Design

## Goal

Add a persistent metrics layer that is populated automatically by `train` and `upgrade`, exposed through the CLI, and stored with the same `current.json` + `history.jsonl` + `snapshots/` pattern already used by upgrade, brain, training, and recovery flows.

The release should make it easy to answer:

- Are Luau safety signals improving?
- Are locals, remotes, callbacks, or flags trending up or down?
- Is `pcall` coverage improving?
- Did the latest `train` or `upgrade` run regress against the recent baseline?

## Architecture

Keep `bin/agent-system.mjs` as the main entrypoint, but move the metrics logic into a small `lib/metrics.mjs` module so the command surface stays thin and testable.

The metrics layer should follow the same workspace-contract pattern used elsewhere in the repo:

- `docs/metrics/current.json` holds the latest materialized snapshot.
- `docs/metrics/history.jsonl` stores append-only snapshot history.
- `docs/metrics/snapshots/<timestamp>.json` stores immutable point-in-time captures.

This should remain observational. Metrics can alert and compare, but they should not block delivery by default.

## Data Model

Each snapshot should capture a stable summary of the current workspace:

- total lines
- local count
- remote call count
- callback count
- flag count
- UI control count
- `pcall` coverage percentage
- ESP connection count
- named thread count
- anonymous thread count
- risk counts by severity
- brain note counts by tag

The snapshot should also include provenance fields:

- `generatedAt`
- `activeProfile`
- `activeHost`
- `source` such as `train`, `upgrade`, or `eval`
- `summaryPath`
- `snapshotPath`
- `historyPath`

## Command Surface

Add a new `metrics` command family to `bin/agent-system.mjs`:

- `metrics`
  - print the current snapshot summary
- `metrics show`
  - alias for the current snapshot summary
- `metrics trend`
  - compare current metrics against the recent history
- `metrics compare`
  - compare two snapshots or the current snapshot against a selected baseline
- `metrics snapshot`
  - force a manual snapshot capture when needed

The CLI output should stay readable in terminal form, with a compact summary first and deltas below it.

## Integration Points

`train` should write a metrics snapshot after a successful run.

`upgrade` should also write a metrics snapshot so the same workspace can be observed after the learning-aware upgrade cycle.

`eval` can read the metrics trail to report regression context, but it should not require the metrics trail to exist before it runs.

If a metrics snapshot is missing, the command should fail closed only for the metrics command itself. Regular `train`, `upgrade`, and `eval` flows should still complete and may seed the metrics files opportunistically.

## CLI Behavior

The summary should answer the most common questions first:

- current totals
- current `pcall` coverage
- current risk profile
- delta from the previous snapshot
- trend direction over the latest history slice

If a threshold is exceeded, the CLI should print a warning, not a hard failure, unless a separate future gate asks for blocking behavior.

## Testing

Add tests that prove:

- the metrics files are created in the expected directory layout
- `train` auto-populates the metrics snapshot
- `upgrade` also populates metrics
- `metrics trend` and `metrics compare` can read historical snapshots
- the current snapshot is stable enough to diff against the last run
- the surface contract exposes the new command family

Prefer small fixtures that make the metrics obvious:

- one Luau file with several locals and remotes
- one clean workspace with low-risk counts
- one regression fixture that increases locals or lowers `pcall` coverage

## Exclusions

Do not add a database or external analytics service.
Do not block releases on metrics drift in this release.
Do not fold metrics into brain, upgrade, or training history formats.
Do not invent a second dashboard format when the repo already uses JSON and JSONL state files.

## Release Outcome

After this release, the repo should have:

- a consistent metrics history trail
- a CLI-visible dashboard for current and historical metrics
- automatic snapshot capture on `train` and `upgrade`
- enough data to support future regression gating without changing the core workflows again
