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

- `memory/system.md` stores durable rules that apply to the whole repository.
- `memory/profile/<profile>.md` stores profile-specific lessons and preferences.
- `memory/host/generic.md` stores host-agnostic adaptation notes.
- `memory/host/<host>.md` stores host-specific behavior when a host needs its own rule.

Durable rules should be written where they belong first, then mirrored outward only if they remain true across a wider scope.

## V0.1 intent

This is a bootstrap scaffold: enough structure to enforce routing and artifacts without trying to automate every decision.
