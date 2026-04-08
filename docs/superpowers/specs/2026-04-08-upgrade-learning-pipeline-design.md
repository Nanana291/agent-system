# Upgrade Learning Pipeline Design

**Goal:** Turn `/upgrade` into a real learning pipeline that previews changes, learns per-agent lessons, applies the learned sync, replays historical upgrades, and reports what each agent absorbed. The new flow should improve the affected agents and the host/profile memories together so the repo can reuse what it learned instead of treating upgrade as a passive sync.

**Architecture:** Keep `upgrade` in the existing Node.js CLI, but split its behavior into explicit phases with dedicated outputs and state files. `preview` inspects the current upgrade target and affected agent sections without writing anything. `learn` turns those sections into per-agent lessons, deduplicates them against upgrade history, and stores the durable learning snapshot. `apply` materializes the learned result into agent docs and memory files. `sync` rehydrates the stored upgrade state without re-inference. `report` produces a readable summary of what changed, what each agent learned, and what was blocked. `upgrade` itself remains the compatibility entry point for the full pipeline, but it should now run the learning-aware path instead of a plain sync.

**Tech Stack:** Node.js ESM CLI, JSON/JSONL state files, markdown docs, host-scoped memory files, existing `AGENTS.md` and `profiles/<profile>/AGENTS.md` sync model, Node test runner.

---

## Problem Statement

The current `/upgrade` command is useful, but it is still mostly a sync primitive. It takes a target, extracts agent sections, writes a sync block, and mirrors the result into profile and host memory. That is enough to keep docs aligned, but it does not teach the system anything in a durable way beyond the next sync pass.

What is missing is a real learning loop:
- per-agent lessons instead of one generic upgrade summary
- a durable upgrade history that can be replayed and compared
- explicit learning and reporting phases
- a way for the system to remember what each agent absorbed from the last upgrade
- a visible slash-command surface that exposes the richer pipeline instead of hiding it behind one opaque command

The new design closes that gap while staying inside the repo-local contract. It does not fine-tune a model externally; it writes the learned rules into docs, memory, and audit files so the next upgrade pass can reuse them.

## Scope

This update covers:
- expanding `/upgrade` into `preview`, `learn`, `apply`, `sync`, `report`, and `replay`
- persisting upgrade learning state in `docs/upgrade/`
- recording per-agent lessons and confidence in upgrade history
- improving the sync so it can write learned content per agent, not just one global block
- syncing the learned result into `AGENTS.md`, `profiles/<profile>/AGENTS.md`, `memory/profile/<profile>.md`, and host memory files
- writing a readable session report for each upgrade run
- adding slash-command docs for the new upgrade phases

This update does not cover:
- external model training or weight updates
- distributed coordination across machines
- database-backed persistence
- automatic branch management or git history rewriting
- replacing `train`; upgrade remains a separate contract for instruction sync and local learning

## Proposed Command Surface

`upgrade` should support these forms:
- `upgrade` runs the full learning-aware pipeline
- `upgrade preview` parses the target and shows the affected agents without writing
- `upgrade learn` computes the per-agent lessons and stores the upgrade learning state
- `upgrade apply` writes the learned sync blocks and memory updates
- `upgrade sync` rehydrates the stored learning state without re-inference
- `upgrade report` prints a readable summary of the current or last upgrade run
- `upgrade replay` re-runs a historical upgrade session against the current target and compares the result
- `upgrade docs` keeps the docs-only sync path for compatibility
- `upgrade profile` keeps the profile-doc and profile-memory sync path for compatibility
- `upgrade memory` keeps the memory-only sync path for compatibility
- `upgrade hosts` keeps the host-memory-only sync path for compatibility

The compatibility modes are preserved so existing host workflows do not break, but the preferred path becomes the explicit learning pipeline.

## Upgrade Learning Model

Upgrade learning is per agent, not just per target.

Each affected agent section should produce a learned record with:
- agent title
- normalized agent key
- section heading
- extracted lesson text
- evidence from the source body
- affected paths
- confidence or durability score
- promotion state
- last learned session

The system should deduplicate lessons against previous upgrade sessions so the same rule does not keep reappearing as a brand-new discovery. A lesson that already exists should be treated as reinforcement, not as a novel upgrade.

Learning should prefer:
- ownership clarity
- reduced ambiguity
- tighter visible terminology
- stable sync/recovery paths
- explicit host coverage when the lesson affects multiple hosts

## Storage Model

The upgrade pipeline should persist its own state under a dedicated docs subtree:
- `docs/upgrade/current.json`
- `docs/upgrade/history.jsonl`
- `docs/upgrade/README.md`
- `docs/upgrade/sessions/<session>.md`
- `docs/upgrade/replay/<session>.json` for replay comparisons or equivalent session artifacts

The current upgrade snapshot should capture:
- active profile
- active host
- source target
- active mode
- affected agents
- per-agent lessons
- hosts synced
- write scope
- replay source if applicable
- blocked reasons if any

The history log should append each run so the system can compare the latest upgrade with the previous one and explain whether a lesson was reinforced or newly learned.

## Sync Model

`apply` and `sync` should remain idempotent.

The written sync should update:
- `AGENTS.md`
- `profiles/<profile>/AGENTS.md`
- `memory/profile/<profile>.md`
- `memory/host/claude.md`
- `memory/host/codex.md`
- `memory/host/qwen.md`

The content written into those files should reflect the learned per-agent records instead of only the raw source sections. If a lesson is already present, the pipeline should refresh the existing block rather than appending a duplicate.

The learned upgrade state should also feed the structured brain so the same lesson can be queried later without re-parsing the source target.

## Command Behavior

### `upgrade preview`
Parse the upgrade target and show:
- target path
- affected agents
- session scope
- whether the current source appears to contain learnable sections
- any blocking conditions that would stop `apply`

### `upgrade learn`
Build the upgrade learning state from the target and previous history:
- normalize each agent section
- extract a lesson for each agent
- compare against the latest history entries
- mark lessons as new, reinforced, or blocked
- write `docs/upgrade/current.json`
- append `docs/upgrade/history.jsonl`

### `upgrade apply`
Materialize the learned blocks into docs and memory:
- write the upgraded sync block into `AGENTS.md`
- write the same learned result into the active profile doc
- write profile and host memory blocks
- preserve idempotency if the same upgrade is applied twice

### `upgrade sync`
Reapply the stored upgrade state without re-inferring lessons:
- read `docs/upgrade/current.json`
- rehydrate the same sync result
- avoid changing the learned content unless the stored state changed

### `upgrade report`
Print a compact report that names:
- the target
- the active host
- the affected agents
- the lesson status for each agent
- the write scope
- what was learned versus what was only reinforced

### `upgrade replay`
Use a prior session snapshot and compare it to the current target:
- if the same lesson still applies, mark it stable
- if the target diverged, show the drift
- do not auto-promote a replayed lesson that no longer matches the target

## Data Flow

1. The user runs `upgrade` or one of its subcommands.
2. The CLI loads the active profile, the source target, and the current upgrade state.
3. `preview` identifies the affected agents and blocking conditions.
4. `learn` derives per-agent lessons and stores them in `docs/upgrade/`.
5. `apply` writes the learned sync to the docs and memory layers.
6. `sync` rehydrates the stored state without re-inference.
7. `report` summarizes the result for the user and for later audits.
8. The learned result is captured into the structured brain so it can be queried later.

## Error Handling

The implementation must fail closed:
- If the upgrade target is missing, the command stops.
- If no agent sections can be found, `learn` must not fabricate lessons.
- If a lesson cannot be assigned to an agent, it should be marked blocked and remain review-only.
- If `apply` cannot write to the profile or host memory files, it should not claim the upgrade succeeded.
- If replayed lessons no longer match the current target, the replay must report drift instead of promoting stale guidance.
- If a sync block already exists, it should be replaced in place instead of duplicated.

## Testing

The feature is complete only when these behaviors pass:
- `upgrade preview` reports the target and affected agents without writing files
- `upgrade learn` creates a durable upgrade snapshot and history entry
- `upgrade apply` writes learned blocks into docs and memory files idempotently
- `upgrade sync` reuses stored upgrade state without re-inference
- `upgrade report` surfaces per-agent learning status
- `upgrade replay` detects drift when the target changed
- repeated upgrade runs do not duplicate sync blocks
- validation and lint still pass after the upgrade pipeline runs

## Non-Goals

This update does not:
- fine-tune model weights externally
- create a shared knowledge store outside the repo
- add remote telemetry
- replace the existing training system
- remove the current compatibility forms of `upgrade`

## Expected Outcome

After `0.6.3`, `/upgrade` should feel like a real learning pipeline. The repo will be able to parse a target, learn per-agent lessons, materialize them into docs and memory, and report exactly what each agent absorbed. The model-facing behavior stays repo-local, but the learned result becomes durable enough to guide later changes without re-deriving the same lesson every time.
