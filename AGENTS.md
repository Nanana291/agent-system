# Agent System

`agent-system` is a universal routing layer for agentic repos. It does not replace Superpowers; it complements it.

## Authority split

- Superpowers owns process choice.
- Agent System owns route selection, ownership, handoff contracts, artifact requirements, and delivery gates.
- Profile packs own repo-specific rules.

## Core model

- `agent-system.json` defines the machine-readable system contract.
- `profiles/<profile>/profile.json` defines the active profile contract.
- `profiles/<profile>/AGENTS.md` explains the profile in human terms.

## Artifact model

The repo standardizes these outputs:

- `[TASK LOCK]` for task classification and route selection
- `[HANDOFF]` for ownership transfer
- `[DELIVERY GATE]` for release closure
- `regression-matrix.md` for proof and parity checks

## Host compatibility

Claude Code, Codex, and Qwen Code all read the same core contract. Each host has a thin adapter doc, but the source of truth stays in the manifest and profile files.

## Memory contract

- `memory/host/claude.md`, `memory/host/codex.md`, and `memory/host/qwen.md` store host-specific lessons.
- `memory/packs/claude.md`, `memory/packs/codex.md`, and `memory/packs/qwen.md` store compact host learning packs.
- The active host is the boundary for capture and promotion.
- `memory/change/<host>.md` stores host-local change lessons before they are promoted into that same host's main memory file.
- The host refinement loop uses `memory review`, `memory compress`, `memory teach`, `memory gate`, `memory reflect`, and `memory packs` to keep lessons compact before promotion.

Durable rules should be written where they belong first, then kept inside the host that learned them.

## Presence contract

- `status/current.json` stores the active agent presence snapshot.
- `status/events.jsonl` stores append-only presence events.
- `status watch` renders live presence lines for terminal use.
- `status heartbeat`, `status who`, and `status attach` extend the presence layer into a simple session tracker.
- The canonical human-facing format is `[AGENT] <name> | <action> | <elapsed>`.
- `docs/brain/current.json`, `docs/brain/history.jsonl`, and `docs/brain/snapshots/` store the structured second brain and its recoverable snapshots.
- `brain add`, `brain query`, `brain explain`, `brain promote`, `brain demote`, `brain prune`, `brain snapshot`, `brain restore`, `brain diff`, and `brain sync` manage the second brain layer.
- `backup` captures the full mutable workspace into one portable bundle.
- `restore` writes a validated backup bundle back into the workspace and then runs post-restore validation.
- `bundle validate`, `bundle diff`, and `bundle prune` inspect or clean backup bundles without touching live state.
- `memory snapshot`, `memory restore`, `memory diff`, and `memory rollback` manage host learning recovery snapshots.
- `change/current.json`, `change/history.jsonl`, and `change/intake.md` support a universal change workflow for updates and new projects.
- `change analyze`, `change scout`, `change auto-scaffold`, `change scaffold`, `change preview`, `change apply`, `change diff`, `change rollback`, and `change gate` are the change workflow entry points.
- `change memory-suggest` proposes durable lessons to promote from change memory.
- `quick-update` prepares a ready-to-review update intake from target and intent without requiring `git diff`.
- `quick-fix` handles a single-file code/config fix with a fast lock, fast gate, and quick memory capture.
- `route` auto-suggests `quick-fix` when the workspace has exactly one touched code/config file.
- `luau-quick` handles a single-file Luau fix with a Luau-specific lock, gate, and memory note.
- `route` keeps the generic quick-fix path for single-file code/config edits and adds Luau-specific wording when the single touched file is Luau.
- `luau-explain` and `luau-diagnose` surface the Luau repair path and the issues that trigger it.
- `luau-repair` applies multi-file Luau repairs, writes the repair snapshot, and syncs memory, docs, and AGENTS.
- `luau-gate` validates the Luau repair snapshot before delivery.
- `train explain` and `train compare` write host-separated audit trails in `docs/training/explain/<host>.jsonl` and `docs/training/compare/<host>.jsonl`.
- `memory gate` can demote weak host lessons back into `memory/change/<host>.md` before promotion.
- `train` and `eval` auto-detect Luau work or a ready Luau repair snapshot and write Luau-focused lessons into the training and evaluation logs.
- `luau-train` and `luau-eval` force the Luau learning focus when you want to train or score Luau work directly.
- `train status` prints the current training state, the continuous-training state, and the latest host pack snapshot.
- `train history` prints recent host-scoped training runs without mutating the training log.
- `train rollback` restores the latest host learning snapshot for the active host.
- `upgrade` applies multi-agent instruction upgrades and syncs the resulting memory into the active profile and all supported host memories.
- `upgrade preview` and `upgrade status` inspect the upgrade target without writing files.
- `upgrade docs`, `upgrade profile`, `upgrade memory`, and `upgrade hosts` let you scope the upgrade pass to docs, profile memory, or host memory layers.
- `docs/training/current.json`, `docs/training/history.jsonl`, and `docs/training/<session>.md` record the automatic training loop.
- `docs/training/continuous.json`, `docs/training/continuous-history.jsonl`, and `docs/training/continuous.md` record the continuous-training loop state.
- `docs/training/recovery/<host>/latest.json`, `docs/training/recovery/<host>/history.jsonl`, and `docs/training/recovery/<host>/snapshots/<timestamp>.json` record host learning recovery snapshots.
- `train`, `train error`, `train review`, `train replay`, `train promote`, `train sync`, `train explain`, `train compare`, and `train packs` train several agents at once, auto-promote durable lessons on successful runs, refresh the host learning pack, sync the active host memory, and write auditable lesson trails.
- `docs/evals/current.json`, `docs/evals/history.jsonl`, and `docs/evals/<session>.md` record the evaluation loop.
- `eval`, `eval simulate`, `eval score`, `eval compare`, and `eval promote` score the current workspace and promote durable lessons when the score clears the threshold.
- `memory/change/<host>.md` stores auto-captured lessons from change gates before promotion into that same host's memory file.
- `memory learn` auto-promotes repeated change lessons into the active host's memory file during a successful gate.

## V0.6.2 intent

This release keeps the structured second brain between the model and the agents, but tightens the materialized read path and memory quality so the same durable knowledge is easier to trust, query, and recover. `brain add`, `brain query`, `brain explain`, `brain promote`, `brain demote`, `brain prune`, `brain snapshot`, `brain restore`, `brain diff`, and `brain sync` still capture, explain, and recover durable knowledge automatically from change, train, eval, memory, upgrade, and recovery flows.
