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
- `docs/brain/` stores the structured second brain that collects durable lessons from change, train, eval, memory, upgrade, and recovery flows.
- `docs/metrics/` stores the materialized workspace metrics trail: `current.json`, `history.jsonl`, and immutable `snapshots/`.

## Supported hosts

- Claude Code
- Codex
- Qwen Code
- OpenCode

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

### OpenCode

Open the repository in OpenCode and it will load the local tool surface from `.opencode/tools/agent_system.ts`.

The local OpenCode contract lives in:

- `OPENCODE.md`
- `adapters/opencode/README.md`
- `.opencode/package.json`
- `.opencode/tools/agent_system.ts`

## V0.6.4.4 scope

This release keeps `/upgrade` as a learning-aware pipeline, but closes the release-critical proof gap with executable enforcement and adds a materialized metrics trail. `upgrade preview`, `upgrade learn`, `upgrade apply`, `upgrade sync`, `upgrade report`, `upgrade status`, `upgrade replay`, and the new `delivery-check` gate now make the upgrade trail and delivery closure verifiable instead of markdown-only. The CLI surface also exposes `npm run luau-train`, `npm run upgrade-status`, `npm run metrics`, `npm run metrics-trend`, and `npm run metrics-compare` as direct aliases for the common Luau, upgrade, and metrics paths. OpenCode gets a native local tool surface through `.opencode/tools/agent_system.ts`.

The upgrade pipeline is still per-agent. It learns from the active target, dedupes lessons against prior upgrade history, writes a durable upgrade snapshot in `docs/upgrade/current.json`, appends `docs/upgrade/history.jsonl`, and syncs the learned result into the profile doc plus host memory. Upgrade sessions stay materialized under `docs/upgrade/sessions/` so replay can compare the current docs against the last known good snapshot.

The brain remains event-sourced and fed by `change`, `train`, `eval`, `memory`, `upgrade`, and recovery flows. Durable lessons continue to land in `docs/brain/current.json` and `docs/brain/history.jsonl`, then sync into host and profile memory once they stabilize. Brain hygiene now has a deterministic dedupe path so duplicate notes can be surfaced and consolidated.

The metrics trail uses the same materialized contract as the other runtime histories. `docs/metrics/current.json` holds the latest snapshot, `docs/metrics/history.jsonl` keeps append-only history, and `docs/metrics/snapshots/` stores immutable captures. `metrics`, `metrics trend`, and `metrics compare` read those files, while `train` and `upgrade` append fresh snapshots after successful runs.

Learning recovery still exists: `memory snapshot`, `memory restore`, `memory diff`, `memory rollback`, and `train rollback` preserve host learning state as a recoverable snapshot. Training packs remain versioned, host histories stay separated, and Luau repair / Luau learning still feed the training loop automatically.

`train` remains the continuous improvement engine. Successful cycles still auto-promote durable lessons, refresh the host learning pack, write a continuous-training snapshot in `docs/training/`, and leave a structured brain trace so the same lesson can be retrieved, explained, or promoted later without re-deriving it from raw session logs.

## V0.6.8.0 — New Analysis Tools

This release adds 5 new commands for Luau script analysis and brain management:

- **`luau-inspect`** — Structured script analysis: features, remotes, UI framework, loops, lifecycle, config, and hotspots
- **`luau-verify-features`** — Feature parity verification: proves all baseline features survive in V2 migrations with logic path validation
- **`luau-pcall-audit`** — Remote safety audit: scans all `FireServer`/`InvokeServer` calls and flags unprotected ones with risk scoring
- **`luau-ui-map`** — UI hierarchy extraction: outputs tab → section → control tree with event wiring summary
- **`brain-import`** — External brain import: loads JSON entries with deduplication, normalization, and optional merge

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
node ./bin/agent-system.mjs brain add --host qwen "Keep route fallback deterministic."
node ./bin/agent-system.mjs brain query fallback
node ./bin/agent-system.mjs brain explain "Luau hot-path safety"
node ./bin/agent-system.mjs brain promote fallback
node ./bin/agent-system.mjs brain demote fallback
node ./bin/agent-system.mjs brain prune
node ./bin/agent-system.mjs brain snapshot ./brain-snapshot.json
node ./bin/agent-system.mjs brain restore --file ./brain-snapshot.json
node ./bin/agent-system.mjs brain diff --file ./brain-snapshot.json
node ./bin/agent-system.mjs brain sync
node ./bin/agent-system.mjs train
node ./bin/agent-system.mjs train status --host qwen
node ./bin/agent-system.mjs train history --host qwen --limit 5
node ./bin/agent-system.mjs luau-train
node ./bin/agent-system.mjs metrics
node ./bin/agent-system.mjs metrics trend
node ./bin/agent-system.mjs metrics compare
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
node ./bin/agent-system.mjs upgrade preview
node ./bin/agent-system.mjs upgrade learn
node ./bin/agent-system.mjs upgrade apply
node ./bin/agent-system.mjs upgrade sync
node ./bin/agent-system.mjs upgrade report
node ./bin/agent-system.mjs upgrade status
node ./bin/agent-system.mjs upgrade replay
node ./bin/agent-system.mjs upgrade profile
node ./bin/agent-system.mjs upgrade memory
node ./bin/agent-system.mjs upgrade hosts
node ./bin/agent-system.mjs upgrade status
node ./bin/agent-system.mjs train --luau
node ./bin/delivery-check.mjs
node ./bin/upgrade-apply.mjs
node ./bin/upgrade-sync.mjs
node ./bin/upgrade-replay.mjs
node ./bin/brain-query.mjs fallback
node ./bin/brain-dedupe.mjs --scope host:qwen
node ./bin/backup-validate.mjs ./agent-system-backup.json
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
