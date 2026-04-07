# Agent Host Memory Learning Design

**Goal:** Add a host-specific learning layer so Claude, Codex, and Qwen each accumulate their own durable lessons, without a shared memory blob between models.

**Architecture:** `agent-system` keeps memory flat and host-scoped. Each host writes to its own memory file, `memory/host/claude.md`, `memory/host/codex.md`, or `memory/host/qwen.md`, and the CLI becomes responsible for capture, consolidation, promotion, and audit inside that host boundary only. `change gate` records the outcome of a run, then `memory learn` uses repetition and explicit durability rules to promote lessons within the active host. No memory is shared across hosts, and no system-wide memory file is introduced.

**Tech Stack:** Node.js CLI, JSON manifests, markdown memory files, existing `change/` and `memory/` workspace layout.

---

## Problem Statement

The current memory model is useful for repo-wide notes, but it still behaves like a single knowledge pool. That is too coarse for mixed-host workflows. Qwen may need more guidance on Luau and routing, while Claude or Codex may need different guardrails. A shared memory layer would mix those signals and weaken each host's specialization.

The desired behavior is host-specific self-learning:
- Claude should learn from Claude runs.
- Codex should learn from Codex runs.
- Qwen should learn from Qwen runs.
- The memory for one host must never be written into another host automatically.

## Scope

This version covers:
- host-specific memory capture
- host-specific memory learning
- host-specific promotion and pruning
- automatic capture after successful or blocked `change gate`
- audit and stats per host

This version does not add:
- any shared `memory/system.md`
- any profile-scoped memory layer as a source of truth
- any cross-host promotion
- any domain-specific subfolders under each host memory file
- any model fine-tuning, embeddings, or external training pipeline

## Proposed Storage Model

Each host gets one plain markdown file:
- `memory/host/claude.md`
- `memory/host/codex.md`
- `memory/host/qwen.md`

These files stay flat. The file itself is the source of truth for that host.

The learning flow uses three host-local states:
- `memory/change/<host>.md` for change-specific lessons captured after gates
- `memory/host/<host>.md` for durable host lessons
- `change/current.json` for the current active intake and gate metadata

## Learning Rules

`memory learn` runs against one host at a time.

Promotion rules:
- Repeated lessons in `memory/change/<host>.md` are candidates for promotion into `memory/host/<host>.md`.
- A lesson becomes promotable when it appears at least twice or matches a durable pattern already seen in the same host memory.
- A lesson only promotes upward if it is phrased broadly enough to remain valid across future runs of the same host.
- Lessons mentioning another host, a workspace-specific path, or an ephemeral run detail stay in change memory.

Guardrails:
- No lesson crosses hosts automatically.
- `memory learn` never writes to another host's file.
- `change gate` can trigger learning, but the target host is always the active host from the workspace.
- If a host-specific lesson is too narrow, it stays in `memory/change/<host>.md` and is not promoted.

## CLI Behavior

The CLI should support these host-aware operations:
- `memory capture --host <claude|codex|qwen> change`
- `memory learn --host <claude|codex|qwen> --apply`
- `memory promote --host <claude|codex|qwen> --from change --to host`
- `memory audit --host <claude|codex|qwen>`
- `memory stats` should report host counts separately

Automatic behavior:
- `change gate` captures a note into the active host change memory file.
- If the gate passes, `change gate` also runs `memory learn` for that same host.
- If the gate fails, the failure note still lands in the active host change memory file, but no cross-host promotion occurs.

## Data Flow

1. A host runs a change workflow.
2. `change gate` evaluates readiness.
3. The gate result is appended to that host's change memory.
4. `memory learn` scans the host's change memory for repetition and durable phrasing.
5. Repeated or durable lessons are promoted into that same host's main memory file.
6. `memory audit` verifies the host memory file still reflects the expected host-specific rules.

## Failure Handling

The implementation must fail closed:
- If the active host cannot be resolved, the CLI should refuse to promote memory.
- If the host memory file is missing, the CLI should create the file before writing.
- If a lesson cannot be classified as durable, it stays in change memory.
- If a learning pass would write outside the active host boundary, it must stop.

## Verification

The feature is complete only when all of these pass:
- the existing change workflow tests
- host-specific memory capture tests
- host-specific memory learn promotion tests
- automatic `change gate` learning tests
- validation and lint for the repo manifest and memory schema

## Non-Goals

This version does not:
- build a universal shared memory layer
- add embeddings or vector search
- auto-train a model externally
- infer memory across hosts
- change the meaning of the existing change intake schema beyond host scoping

## Expected Outcome

After 0.4.6, each host becomes a separate learner. Qwen can steadily improve its own Luau and agent workflows without inheriting unrelated Claude or Codex lessons, and the repo keeps the memory model simple enough to audit by hand.
