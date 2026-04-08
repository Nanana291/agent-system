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
- `backup` captures the full mutable workspace into one portable bundle.
- `restore` writes a validated backup bundle back into the workspace and then runs post-restore validation.
- `bundle validate`, `bundle diff`, and `bundle prune` inspect or clean backup bundles without touching live state.
- `change/current.json`, `change/history.jsonl`, and `change/intake.md` support a universal change workflow for updates and new projects.
- `change analyze`, `change scout`, `change auto-scaffold`, `change scaffold`, `change preview`, `change apply`, `change diff`, `change rollback`, and `change gate` are the change workflow entry points.
- `change memory-suggest` proposes durable lessons to promote from change memory.
- `quick-update` prepares a ready-to-review update intake from target and intent without requiring `git diff`.
- `quick-fix` handles a single-file code/config fix with a fast lock, fast gate, and quick memory capture.
- `route` auto-suggests `quick-fix` when the workspace has exactly one touched code/config file.
- `luau-quick` handles a single-file Luau fix with a Luau-specific lock, gate, and memory note.
- `route` keeps the generic quick-fix path for single-file code/config edits and adds Luau-specific wording when the single touched file is Luau.
- `train` and `eval` auto-detect Luau work and write Luau-focused lessons into the training and evaluation logs.
- `luau-train` and `luau-eval` force the Luau learning focus when you want to train or score Luau work directly.
- `upgrade` applies multi-agent instruction upgrades and syncs the resulting memory into the active profile and all supported host memories.
- `docs/training/current.json`, `docs/training/history.jsonl`, and `docs/training/<session>.md` record the automatic training loop.
- `train`, `train error`, `train review`, `train replay`, `train promote`, and `train sync` train several agents at once, sync the active host memory, and write an auditable lesson trail.
- `docs/evals/current.json`, `docs/evals/history.jsonl`, and `docs/evals/<session>.md` record the evaluation loop.
- `eval`, `eval simulate`, `eval score`, `eval compare`, and `eval promote` score the current workspace and promote durable lessons when the score clears the threshold.
- `memory/change/<host>.md` stores auto-captured lessons from change gates before promotion into that same host's memory file.
- `memory learn` auto-promotes repeated change lessons into the active host's memory file during a successful gate.

## V0.5.5 intent

This release keeps the portable recovery, training, and evaluation layers intact, and adds a Luau learning loop on top of the Luau quick path: the repo can still snapshot the mutable workspace, validate the bundle, prune duplicate noise, restore the state back into a clean checkout, prepare a fast update intake from just target plus intent, suggest a quick lock when one code/config file is touched, write a Luau lock, gate, and memory note directly when the single changed file is a Luau script, and now auto-feed that Luau context into training, evaluation, and host memory so repeated Luau work learns from the previous run.
