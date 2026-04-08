# agent-system.mjs Baseline

## Script Identity

- Path: `bin/agent-system.mjs`
- Role: universal orchestration CLI
- Focus: validation, routing, memory, status, and change workflow support

## Current Baseline Notes

- `validate` checks the active profile, status files, change files, training logs, training continuity files, per-host training explain/compare histories, evaluation logs, backup schema, quick-update flow, quick-fix flow, luau-quick flow, luau repair flow, upgrade flow, and host memory layout.
- `lint` enforces manifest consistency, memory drift checks, status presence, change presence, pack presence, training presence, training continuity presence, host training audit presence, evaluation presence, backup schema presence, quick-update coverage, quick-fix coverage, luau-quick coverage, luau-repair coverage, upgrade coverage, and training coverage.
- `status` owns presence, heartbeat, and session attachment.
- `memory` owns review, compress, teach, gate, reflect, and learning pack generation per host.
- `memory demote` owns weak host lesson removal and change-memory fallback for the active host.
- `change` owns intake analysis, scaffold generation, preview/apply, rollback, and gate validation.
- `backup`, `restore`, and `bundle` own portable snapshot capture, validation, diffing, and pruning.
- `quick-update` owns fast update intake preparation from target and intent without git-diff dependence.
- `quick-fix` owns single-file code/config fixes with a fast lock, fast gate, and quick memory capture.
- `luau-quick` owns single-file Luau fixes with a Luau-specific lock, gate, and memory note.
- `luau-explain` explains the selected Luau repair path and proof.
- `luau-diagnose` reports the Luau repair path and the issues that triggered it.
- `luau-repair` applies multi-file Luau repairs, writes the Luau repair snapshot, and syncs memory, docs, and AGENTS.
- `luau-gate` validates the Luau repair snapshot before delivery.
- `train` auto-detects Luau work and writes Luau-focused lessons into the training log when the active change or repair snapshot is Luau-aware.
- `eval` auto-detects Luau work and writes Luau-focused lessons into the evaluation log when the active change or repair snapshot is Luau-aware.
- `luau-train` and `luau-eval` force Luau focus when the user wants explicit Luau learning runs.
- `train` auto-promotes durable lessons on successful runs, refreshes the host learning pack, and rewrites the continuous-training snapshot.
- `train explain` and `train compare` emit per-host audit trails under `docs/training/explain/<host>.jsonl` and `docs/training/compare/<host>.jsonl`.
- `train packs` reports or regenerates the host training pack after enough continuous cycles accumulate.
- `memory gate` can demote weak host lessons into `memory/change/<host>.md` automatically when host memory is not ready.
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
- `node --test tests/luau-learning-loop.test.mjs`
- `node --test tests/luau-auto-repair-cli.test.mjs`
- `node --test tests/upgrade-cli.test.mjs`
- `node --test tests/train-cli.test.mjs`
- `node --test tests/eval-cli.test.mjs`
