# Agent Host Memory Refinement Design

**Goal:** Improve host-specific memory quality by adding a stricter self-learning loop that reviews, compresses, teaches, and gates lessons before they become durable host knowledge.

**Architecture:** `agent-system` keeps memory separated by host with no shared system memory. Each host remains a flat learner with its own durable file, and `change gate` continues to capture lessons into the active host's change memory. This update adds a refinement loop on top of that model: `memory review` filters weak or duplicate lessons, `memory compress` reduces repeated material into stable rules, `memory teach` turns validated rules into compact host guidance, and `memory gate` blocks promotion of ambiguous or brittle notes. `agent reflection loop` captures what each host learned after execution, and `learning packs` provide small host-local bundles of repeatable guidance for frequent tasks.

**Tech Stack:** Node.js CLI, markdown memory files, JSON workspace metadata, existing `change/` and `memory/` layout.

---

## Problem Statement

Host-scoped memory is already useful, but it can still accumulate noise. Repeated notes, overly specific run details, and weakly phrased lessons make the host memory harder to trust over time. The current system needs a refinement layer that keeps host learning compact, durable, and easy to reuse during later sessions.

The desired behavior is stricter self-learning:
- Claude, Codex, and Qwen continue learning independently.
- Each host keeps only its own lessons.
- Repetition should collapse into concise rules instead of growing the file indefinitely.
- Weak notes should be rejected before they reach durable memory.

## Scope

This version covers:
- host-local memory review
- host-local memory compression
- host-local memory teaching
- host-local memory gating
- automatic reflection capture after host execution
- small host-local learning packs for recurring patterns

This version does not add:
- shared memory across hosts
- cross-host promotion
- vector search or embeddings
- external training or fine-tuning
- nested domain subfolders inside host memory

## Proposed Behavior

### `memory review`
Scans the active host memory and the active host change memory for:
- duplicates
- weak phrasing
- overly local run details
- lessons that look too narrow to keep

The output is a review result that identifies which notes are worth compressing, which should remain in change memory, and which should be blocked.

### `memory compress`
Reduces repeated host lessons into a shorter stable rule.
Examples of compression targets:
- repeated failure handling notes
- repeated host-specific workflow rules
- repeated guardrails that appear in several change entries

Compression should preserve meaning while removing noise and repetition.

### `memory teach`
Converts validated host rules into a compact guidance block for the active host.
This block should be small enough to read quickly and stable enough to survive future runs.

### `memory gate`
Rejects lessons that are:
- too specific to one run
- ambiguous
- contradicted by other host notes
- too weakly supported to become durable

Only lessons that pass the gate can be promoted into durable host memory.

### `agent reflection loop`
After a host finishes a task, the system records a short reflection note that captures:
- what the host did
- what failed or nearly failed
- what pattern should be remembered
- whether the lesson is local or durable

This note feeds `memory review` and `memory compress`.

### `learning packs`
Generates compact host-local packs for recurring work patterns.
These packs are not a shared system layer and do not replace host memory. They are derived from durable host lessons and are used to keep common guidance easy to reuse.

## Storage Model

The host split remains flat:
- `memory/host/claude.md`
- `memory/host/codex.md`
- `memory/host/qwen.md`

Change memory remains host-specific:
- `memory/change/claude.md`
- `memory/change/codex.md`
- `memory/change/qwen.md`

Derived learning artifacts may be created for convenience, but they must stay host-local and must not become shared memory.
The preferred pack location is:
- `memory/packs/claude.md`
- `memory/packs/codex.md`
- `memory/packs/qwen.md`

## Learning Rules

The refinement loop applies these rules:
- Repeated lessons are candidates for compression.
- Compressed lessons must still be valid without referencing a single run.
- Host guidance should be short, direct, and reusable.
- A lesson that does not pass the gate stays in change memory.
- A reflection note can be promoted only if it survives review and compression.

Promotion policy:
- `memory review` decides whether a note is eligible.
- `memory compress` decides whether the note can be shortened without losing meaning.
- `memory teach` writes the final compact lesson.
- `memory gate` blocks weak or contradictory material from becoming durable.

## CLI Behavior

The CLI should support these host-aware operations:
- `memory review --host <claude|codex|qwen>`
- `memory compress --host <claude|codex|qwen>`
- `memory teach --host <claude|codex|qwen>`
- `memory gate --host <claude|codex|qwen>`
- `memory reflect --host <claude|codex|qwen>`
- `learning packs generate --host <claude|codex|qwen>`
- `learning packs list --host <claude|codex|qwen>`

Automatic behavior:
- `change gate` continues to append host-local lesson notes.
- A successful host execution can trigger `agent reflection loop`.
- The reflection note can feed `memory review` and then `memory compress`.
- `memory gate` must run before durable host memory is updated.

## Data Flow

1. A host completes a task or gate.
2. `agent reflection loop` records the lesson in the active host change trail.
3. `memory review` filters the note for quality.
4. `memory compress` turns repeated material into a stable rule.
5. `memory gate` blocks weak notes and approves durable ones.
6. `memory teach` writes the final compact lesson into the active host memory.
7. `learning packs` are generated from durable host lessons when useful.

## Failure Handling

The implementation must fail closed:
- If the active host cannot be resolved, the CLI must refuse to write durable memory.
- If a lesson is too narrow or ambiguous, it must stay in change memory.
- If compression would remove important meaning, the note should not be compressed.
- If a gate fails, the system should keep the note as review material instead of promoting it.
- If a command would write outside the active host boundary, it must stop.

## Verification

The feature is complete only when all of these pass:
- host-specific memory review tests
- host-specific compression tests
- host-specific teach and gate tests
- reflection capture tests
- learning pack generation tests
- validation and lint for the repo manifest and memory schema

## Non-Goals

This version does not:
- introduce shared memory across hosts
- add embeddings, semantic search, or vector databases
- retrain a model externally
- change the host-isolated storage layout
- move from flat host memory to nested domain memory

## Expected Outcome

After 0.4.6.5, each host should keep cleaner memory and learn faster from its own history. Qwen, Claude, and Codex will each have a smaller but higher-signal memory file, with repeated lessons compressed into stable guidance and weak lessons blocked before they pollute durable memory.
