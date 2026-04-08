# AGENTS SYSTEM

```text
   ___                 __           __   ________
  /   | ____ ___  ____/ /___  _____/ /  / ____/ /___  _________  _____
 / /| |/ __ `__ \/ __  / __ \/ ___/ /  / /   / / __ \/ ___/ __ \/ ___/
/ ___ / / / / / / /_/ / /_/ / /  / /__/ /___/ / /_/ / /  / /_/ (__  )
/_/  |_/_/ /_/ /_/\__,_/\____/_/  /____/\____/_/\____/_/   \____/____/
                         AGENTS SYSTEM
```

`agent-system` is a private orchestration layer for agentic coding work. It complements Superpowers instead of replacing it.

Superpowers decides how to work: brainstorming, planning, debugging, or test-driven execution. Agent System decides who owns the work, what artifacts must exist, and what proof is needed before delivery.

## What lives here

- `agent-system.json` is the source of truth for host support, bootstrap files, profile discovery, and artifact paths.
- `profiles/<profile>/profile.json` defines route logic and domain ownership for a specific workspace.
- `profiles/<profile>/AGENTS.md` is the human-readable companion for that profile.
- `commands/`, `skills/`, `agents/`, and `templates/` provide the shared orchestration surface.
- `adapters/` holds host-specific bootstrap notes for Claude Code, Codex, and Qwen Code.

## Supported hosts

- Claude Code
- Codex
- Qwen Code

## Installation

### Claude Code

Add the repo as a private plugin marketplace, then install the plugin:

```bash
claude plugin marketplace add Nanana291/agent-system
claude plugin install agent-system@agent-system-dev
```

If you prefer the interactive form inside Claude Code:

```text
/plugin marketplace add Nanana291/agent-system
/plugin install agent-system@agent-system-dev
```

### Codex

Tell Codex:

```text
Fetch and follow instructions from https://raw.githubusercontent.com/Nanana291/agent-system/refs/heads/main/.codex/INSTALL.md
```

### Qwen Code

Install the repo as a native Qwen extension:

```bash
qwen extensions install https://github.com/Nanana291/agent-system
```

Short form:

```bash
qwen extensions install Nanana291/agent-system
```

## V0.5.9 scope

This release adds learning recovery. `memory snapshot`, `memory restore`, `memory diff`, and `memory rollback` now preserve host learning state as a recoverable snapshot, and `train rollback` can restore the latest snapshot for the active host. Training packs are versioned, so the host learning surface can be audited and rolled back without guessing what changed.

`train explain` and `train compare` still write host-separated audit trails, `memory gate` can demote weak host lessons back into `memory/change/<host>.md`, and host training packs still appear automatically once a host accumulates enough continuous cycles.

`train` still acts as the continuous improvement engine. Successful cycles auto-promote durable lessons, refresh the host learning pack, and write a continuous-training snapshot in `docs/training/` so the last improvement pass is auditable without opening the full session log. Successful training and memory recovery passes now also capture a host recovery snapshot so rollback has a stable target.

The Luau repair loop from `0.5.6` remains in place: `luau-explain` explains the repair route and proof, `luau-diagnose` reports Luau-specific issues, `luau-repair` can repair multi-file Luau changes across code, config, docs, memory, and `AGENTS.md`, and `luau-gate` blocks incomplete repairs until the repair snapshot is ready.

The Luau learning loop still reuses the repair snapshot automatically. `train` and `eval` auto-detect a completed Luau repair, write Luau-focused lessons into the training and evaluation logs, and sync those lessons into host memory so the next Luau run starts with repair-aware context. The Luau-specific aliases `luau-train` and `luau-eval` still expose the same loop directly when you want to force the focus.

## Memory layer

The repo now treats memory as flat and host-specific:

- `memory/host/claude.md` for Claude-specific lessons
- `memory/host/codex.md` for Codex-specific lessons
- `memory/host/qwen.md` for Qwen-specific lessons

The active host is the boundary. Lessons stay in that host's file unless they clearly belong there for future runs of the same host.

## CLI

```bash
node ./bin/agent-system.mjs validate
node ./bin/agent-system.mjs lint
node ./bin/agent-system.mjs route --task-type feature-addition
node ./bin/agent-system.mjs explain "config persistence migration"
node ./bin/agent-system.mjs gate --file templates/delivery-gate.md
node ./bin/agent-system.mjs profile
node ./bin/agent-system.mjs sync --write
node ./bin/agent-system.mjs init demo-profile
node ./bin/agent-system.mjs memory list host:qwen
node ./bin/agent-system.mjs memory add host:qwen "Keep route fallback deterministic."
node ./bin/agent-system.mjs memory search fallback
node ./bin/agent-system.mjs memory promote change host:qwen "When a mistake has a clear fix and prevention rule, record it here before promoting it outward."
node ./bin/agent-system.mjs memory prune
node ./bin/agent-system.mjs memory audit
node ./bin/agent-system.mjs memory stats
node ./bin/agent-system.mjs memory learn --host qwen --apply
node ./bin/agent-system.mjs memory review --host qwen
node ./bin/agent-system.mjs memory compress --host qwen
node ./bin/agent-system.mjs memory teach --host qwen
node ./bin/agent-system.mjs memory gate --host qwen
node ./bin/agent-system.mjs memory demote --host qwen
node ./bin/agent-system.mjs memory snapshot --host qwen ./qwen-learning-snapshot.json
node ./bin/agent-system.mjs memory restore --file ./qwen-learning-snapshot.json
node ./bin/agent-system.mjs memory diff --file ./qwen-learning-snapshot.json
node ./bin/agent-system.mjs memory rollback --host qwen
node ./bin/agent-system.mjs memory reflect --host qwen
node ./bin/agent-system.mjs memory packs generate --host qwen
node ./bin/agent-system.mjs memory packs list --host qwen
node ./bin/agent-system.mjs train
node ./bin/agent-system.mjs luau-train
node ./bin/agent-system.mjs train error --host qwen
node ./bin/agent-system.mjs train replay --host qwen
node ./bin/agent-system.mjs train rollback --host qwen
node ./bin/agent-system.mjs train explain --host qwen
node ./bin/agent-system.mjs train compare --host qwen
node ./bin/agent-system.mjs train packs --host qwen
node ./bin/agent-system.mjs quick-fix --host qwen
node ./bin/agent-system.mjs luau-quick --host qwen
node ./bin/agent-system.mjs luau-explain --host qwen
node ./bin/agent-system.mjs luau-diagnose --host qwen
node ./bin/agent-system.mjs luau-repair --host qwen
node ./bin/agent-system.mjs luau-gate --host qwen
node ./bin/agent-system.mjs eval
node ./bin/agent-system.mjs luau-eval
node ./bin/agent-system.mjs eval compare --host qwen
node ./bin/agent-system.mjs eval promote --host qwen
node ./bin/agent-system.mjs status show
node ./bin/agent-system.mjs status who
node ./bin/agent-system.mjs status set --agent ghost --name Ghost --action "Waiting for ghost to finish auto farm" --state working --scope farm-loop --eta 08:00
node ./bin/agent-system.mjs status heartbeat
node ./bin/agent-system.mjs status attach --agent ghost --task "memory audit" --route "memory -> audit"
node ./bin/agent-system.mjs status clear
node ./bin/agent-system.mjs status watch --interval 2
node ./bin/agent-system.mjs status list --limit 10
node ./bin/agent-system.mjs change analyze --type update --target bin/agent-system.mjs --intent "add universal change orchestration"
node ./bin/agent-system.mjs change scout
node ./bin/agent-system.mjs change auto-scaffold
node ./bin/agent-system.mjs change scaffold --type new-project --name demo-change --target profiles/demo-change --intent "bootstrap a fresh agent workflow"
node ./bin/agent-system.mjs change preview --type update --target bin/agent-system.mjs --intent "preview upcoming change"
node ./bin/agent-system.mjs change apply --type update --target bin/agent-system.mjs --intent "apply upcoming change"
node ./bin/agent-system.mjs change diff
node ./bin/agent-system.mjs change rollback
node ./bin/agent-system.mjs change gate
node ./bin/agent-system.mjs memory capture change
node ./bin/agent-system.mjs change memory-suggest
node ./bin/agent-system.mjs quick-update bin/agent-system.mjs "prepare a fast update path for qwen"
node ./bin/agent-system.mjs upgrade
node ./bin/agent-system.mjs backup ./agent-system-backup.json
node ./bin/agent-system.mjs restore --file ./agent-system-backup.json
node ./bin/agent-system.mjs bundle validate --file ./agent-system-backup.json
node ./bin/agent-system.mjs bundle diff --file ./agent-system-backup.json
node ./bin/agent-system.mjs bundle prune --file ./agent-system-backup.json
node ./bin/agent-system.mjs export --profile imphub
node ./bin/agent-system.mjs import --file ./agent-system-export.json
```

If you install the repo as a package, the binary is exposed as `agent-system`.

## Bootstrap flow

1. Read `README.md` and `AGENTS.md`.
2. Load `agent-system.json`.
3. Open the host-specific bootstrap file.
4. Select the active profile.
5. Emit the required route, handoff, and delivery artifacts.

If a host cannot load a richer integration, use the markdown files directly and keep the structured manifest authoritative.
