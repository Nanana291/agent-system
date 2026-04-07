# Training System Design

**Goal:** Add a universal `/train` command that lets `agent-system` learn from successful runs, failures, replays, and promotions across multiple agents at once. The training loop should update agent instructions, profile memory, and host memory together so Claude, Codex, and Qwen stay synchronized without depending on `git diff`.

**Architecture:** `train` becomes the main learning orchestration surface. It reads the active profile, the current change and status state, and the host-scoped memory files, then produces one training pass for multiple agents. Each pass records three layers of knowledge: direct instruction updates in the human-facing agent docs, durable profile memory, and host-scoped memory for `claude`, `codex`, and `qwen`. The command is automatic by default, but it is still phase-based so success learning, error learning, replay, and promotion remain separate and auditable. `upgrade` stays as the sync layer that can consume the training result, not as the primary training engine.

**Tech Stack:** Node.js CLI, markdown agent docs, JSON state files, host-scoped memory files, existing `profiles/`, `memory/`, `status/`, and `change/` layout, plus a new training audit log under `docs/`.

---

## Problem Statement

The repo already has change gating, host memory learning, and direct upgrade syncing, but those tools are still narrow. They improve one update or one host at a time. They do not yet provide a single training loop that can:
- learn from a successful gate
- learn from a failed run without over-promoting bad lessons
- replay a previous lesson bundle to confirm it still holds
- promote durable lessons into the right memory layer
- keep multiple agents synchronized when the same lesson applies to more than one of them

The result is a gap between "the model noticed something useful" and "the agents now behave better everywhere they should." This version closes that gap.

## Scope

This version covers:
- a top-level `train` command with subactions
- automatic default execution when the user does not specify a subaction
- success learning from verified or gated runs
- error learning from failed runs or rejected upgrades
- replay of prior training bundles
- promotion of durable lessons into profile and host memory
- review output for traceability
- docs-based audit logs for each training session
- multi-agent synchronization across the active profile and all supported hosts

This version does not add:
- external model fine-tuning
- remote telemetry or cloud storage
- automatic cross-repo propagation
- a separate database backend
- git history rewriting or branch management

## Proposed Command Surface

The command should support these subactions:
- `train` with no subaction runs the default full cycle
- `train success` captures a verified win and turns it into durable guidance
- `train error` captures a failure and stores it as a prevention rule
- `train review` emits a readable training report for the current session
- `train replay` re-applies a prior training bundle or lesson set
- `train promote` promotes durable lessons into profile or host memory
- `train sync` applies the derived instruction and memory updates to the profile and host files

The `upgrade` command remains available as a compatibility/sync entry point, but `train` is the primary orchestrator for learning.

## Training Inputs

`train` should derive context from the existing repo state instead of `git diff`.
The command should read:
- `profiles/<profile>/profile.json`
- `profiles/<profile>/AGENTS.md`
- the repo-level `AGENTS.md`
- `status/current.json`
- `change/current.json`
- `change/history.jsonl`
- `memory/profile/<profile>.md`
- `memory/host/claude.md`
- `memory/host/codex.md`
- `memory/host/qwen.md`
- `memory/change/<host>.md`

The command should use these inputs to decide:
- which agents need improvement
- whether the lesson is success-based or error-based
- whether the lesson is durable enough to promote
- which host memories need the same lesson

## Training Behavior

### Success Learning

When a gate or replay succeeds, the command should:
- capture the lesson as a positive pattern
- write the instruction delta into the appropriate agent-facing doc
- add the durable lesson to profile memory
- mirror the host-specific version into the active host memory file
- append a session summary to the training log

### Error Learning

When a gate fails, a replay fails, or an upgrade exposes a mismatch, the command should:
- record the failure mode and the prevention rule
- keep the lesson local until it repeats or is replayed successfully
- avoid promoting a noisy failure directly to system-level guidance
- still write a traceable audit entry so the failure is not lost

### Replay

`train replay` should re-run the last relevant lesson bundle or a selected prior bundle and compare the result against the current state.
Replay is not just a repeat run.
It is a check that the learned rule still applies before promotion.

### Promotion

`train promote` should move a lesson only when it is durable enough for the next layer.
Promotion should be explicit and layered:
- session note -> host memory
- host memory -> profile memory
- profile memory -> visible agent instructions

The command should never guess a global rule when the lesson is only valid for one host.

## Multi-Agent Sync

Training is multi-agent by default.
When the same lesson affects more than one agent, the command should write synchronized updates into each relevant agent section or training block.
It should also mirror the durable version into:
- `profiles/<profile>/AGENTS.md`
- `memory/profile/<profile>.md`
- `memory/host/claude.md`
- `memory/host/codex.md`
- `memory/host/qwen.md`

The sync process should stay idempotent.
If `train` runs twice with the same input, it should replace the existing training block instead of appending duplicates.

## Training Log

Each training run should leave an auditable summary under `docs/`, for example:
- `docs/training/<date>-<session>.md`
- `docs/training/current.json`
- `docs/training/history.jsonl`

The log should include:
- the training subaction
- the active profile
- the active host
- the agents affected
- the lesson outcome
- whether the result was promoted or held
- the verification target that justified the learning

## Error Handling

The implementation must fail closed:
- If the active profile cannot be resolved, `train` stops.
- If the host memory target is missing, the command only creates the active host file if that is safe and expected.
- If the lesson cannot be assigned to an agent, the command records a local note and skips promotion.
- If a replay fails, the command does not auto-promote the lesson.
- If a new instruction conflicts with existing ownership or delivery rules, the command reports the conflict instead of overwriting it.

## Data Flow

1. The user runs `train`.
2. The CLI reads the profile, status, change, and host memory state.
3. The command classifies the run as success, error, replay, review, or promote.
4. The command writes the direct instruction delta into the agent docs.
5. The command writes durable lessons into profile memory and host memory.
6. The command records a training log in `docs/`.
7. The command revalidates the repo state and fails if the sync is incoherent.

## Testing

The feature is complete only when all of these pass:
- `train success` writes a visible instruction delta and memory entry for multiple agents
- `train error` records a prevention rule without over-promoting it
- `train replay` uses a prior bundle or prior lesson and produces a consistent result
- `train promote` updates profile and host memory idempotently
- the training log is written under `docs/`
- validation and lint still pass after training writes
- repeated `train` runs do not duplicate the same sync block

## Non-Goals

This version does not:
- fine-tune the underlying model weights
- store training state in a database
- require `git diff` to operate
- replace the existing `change` or `backup` workflows
- remove `upgrade`; it stays as a sync-oriented companion

## Expected Outcome

After this update, `agent-system` can train its agents as a unified learning loop instead of only syncing updates. The repo will be able to turn successful runs and failure analysis into durable agent instructions and host-scoped memory, while keeping a clear audit trail for every learning pass.
