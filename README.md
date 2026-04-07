# Agent System

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

## V0.4.1 scope

This release adds a universal status bus for live agent presence, plus watchable status rendering for terminal workflows. It is still not a full autonomous dispatcher.

## Memory layer

The repo also carries an optional memory layer:

- `memory/system.md` for repository-wide durable rules
- `memory/profile/<profile>.md` for profile-specific lessons
- `memory/host/generic.md` for portable host notes
- `memory/host/claude.md`, `memory/host/codex.md`, `memory/host/qwen.md` for host-specific behavior

This is the answer to the "agent memory" question: not one global blob, but layered memory with clear ownership.

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
node ./bin/agent-system.mjs memory list profile
node ./bin/agent-system.mjs memory add system "Keep route fallback deterministic."
node ./bin/agent-system.mjs memory search fallback
node ./bin/agent-system.mjs memory promote profile system "When a mistake has a clear fix and prevention rule, record it here before promoting it outward."
node ./bin/agent-system.mjs memory prune
node ./bin/agent-system.mjs memory audit
node ./bin/agent-system.mjs memory stats
node ./bin/agent-system.mjs status show
node ./bin/agent-system.mjs status set --agent ghost --name Ghost --action "Waiting for ghost to finish auto farm" --state working --scope farm-loop --eta 08:00
node ./bin/agent-system.mjs status clear
node ./bin/agent-system.mjs status watch --interval 2
node ./bin/agent-system.mjs status list --limit 10
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
