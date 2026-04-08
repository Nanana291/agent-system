# agent-system.mjs Baseline

## Script Identity

- Path: `bin/agent-system.mjs`
- Role: universal orchestration CLI
- Focus: validation, routing, memory, status, and change workflow support

## Current Baseline Notes

- `validate` checks the active profile, status files, change files, training logs, evaluation logs, backup schema, quick-update flow, quick-fix flow, upgrade flow, and host memory layout.
- `lint` enforces manifest consistency, memory drift checks, status presence, change presence, pack presence, training presence, evaluation presence, backup schema presence, quick-update coverage, quick-fix coverage, upgrade coverage, and training coverage.
- `status` owns presence, heartbeat, and session attachment.
- `memory` owns review, compress, teach, gate, reflect, and learning pack generation per host.
- `change` owns intake analysis, scaffold generation, preview/apply, rollback, and gate validation.
- `backup`, `restore`, and `bundle` own portable snapshot capture, validation, diffing, and pruning.
- `quick-update` owns fast update intake preparation from target and intent without git-diff dependence.
- `quick-fix` owns single-file code/config fixes with a fast lock, fast gate, and quick memory capture.
- `luau-quick` owns single-file Luau fixes with a Luau-specific lock, gate, and memory note.
- `upgrade` owns multi-agent instruction upgrades plus profile and host memory synchronization.
- `train` owns multi-agent training sync, durable lesson capture, and the append-only training log.
- `eval` owns simulation, scoring, comparison, and promotion of durable evaluation lessons.

## Verification Targets

- `node ./bin/agent-system.mjs validate`
- `node ./bin/agent-system.mjs lint`
- `node --test tests/status-cli.test.mjs`
- `node --test tests/change-cli.test.mjs`
- `node --test tests/backup-restore-cli.test.mjs`
- `node --test tests/quick-update-cli.test.mjs`
- `node --test tests/quick-fix-cli.test.mjs`
- `node --test tests/luau-quick-cli.test.mjs`
- `node --test tests/upgrade-cli.test.mjs`
- `node --test tests/train-cli.test.mjs`
- `node --test tests/eval-cli.test.mjs`
