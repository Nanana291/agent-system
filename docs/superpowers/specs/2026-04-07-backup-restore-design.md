# Backup Restore Design

**Goal:** Add a complete, validated backup and restore layer for the mutable state of `agent-system` so the repo can be saved and recovered without depending on git history alone.

**Architecture:** `backup` will build on the existing export/import bundle shape instead of inventing a separate recovery format. The snapshot will capture the authoritative mutable state of the system: manifest, package metadata, docs that define the current release contract, active profiles, host-scoped memory, status, change state, and baseline docs. `restore` will write that snapshot back into the repo, then run validation so recovery fails closed if the bundle is incomplete or inconsistent. The bundle remains host-aware, but host data stays separated by the same flat rules already used in memory.

**Tech Stack:** Node.js CLI, JSON bundle files, markdown workspace docs, existing `memory/`, `status/`, `change/`, `profiles/`, and `docs/baselines/` layout.

---

## Problem Statement

The repo already has export/import support, but that support is aimed at portability for profiles and memory rather than full recovery of the system state. When the repo needs to be moved, restored, or duplicated cleanly, the current tools do not clearly define what belongs in a complete snapshot or how to verify that a restore is safe before writing it back.

The desired behavior is a real recovery workflow:
- A backup should capture the mutable state that makes the repo function.
- A restore should recover that state without silently dropping host-specific data.
- Validation should fail closed if the snapshot is incomplete or mismatched.

## Scope

This version covers:
- full mutable-state backup
- full mutable-state restore
- bundle validation before restore
- bundle diff against the current repo state
- bundle pruning of non-restorable or duplicate noise
- host-aware recovery for memory and change data

This version does not add:
- git tag / branch management
- worktree creation
- repository history rewriting
- external cloud storage
- binary archive formats as the primary bundle shape

## Proposed Bundle Contents

The backup bundle should include:
- `agent-system.json`
- `package.json`
- `README.md`
- `AGENTS.md`
- `profiles/<profile>/profile.json`
- `profiles/<profile>/AGENTS.md`
- `memory/system.md`
- `memory/profile/<profile>.md`
- `memory/host/claude.md`
- `memory/host/codex.md`
- `memory/host/qwen.md`
- `memory/change/<host>.md`
- `memory/packs/<host>.md`
- `status/current.json`
- `status/events.jsonl`
- `change/current.json`
- `change/history.jsonl`
- `docs/baselines/agent-system.mjs.md`

The bundle should also record:
- exported timestamp
- active profile
- active host
- bundle version
- source repo root or label

## Backup Behavior

`backup` generates a portable JSON snapshot from the current repo state.
It should:
- read the current manifest and package version
- capture the active profile and active host
- include host-scoped memory and packs
- include current status and change history
- include baseline docs needed to understand delivery gates
- omit transient or regenerable artifacts like worktrees, caches, and `node_modules`

The command should fail if:
- the active host cannot be resolved
- the active profile cannot be resolved
- a required mutable file is missing
- the bundle would be internally inconsistent

## Restore Behavior

`restore` consumes a previously created backup bundle and writes it back into the repo.
It should:
- validate the bundle before writing
- restore manifest, docs, profiles, memory, status, and change state to their authoritative paths
- preserve host separation exactly as stored in the bundle
- run validation after writing so the restore fails closed if the result is not coherent

Restore should not:
- overwrite git metadata
- create or restore worktrees
- restore ignored/generated directories
- infer a different host for bundle data unless the bundle explicitly says so

## Bundle Validation

`bundle validate` checks that the snapshot has the minimum shape required for restore.
It should verify:
- top-level metadata exists
- the manifest exists and is parseable
- the bundle has an active profile
- host-specific memory and packs are attached to explicit hosts
- required mutable paths are present for the current recovery mode
- no duplicate or conflicting memory paths are present

Validation should fail on:
- missing profile metadata
- missing active host
- malformed JSON
- missing required mutable sections
- host ambiguity in memory or packs

## Bundle Diff

`bundle diff` compares a snapshot against the current repo state.
It should show:
- added, changed, or missing sections
- host-specific memory differences
- profile and manifest differences
- status and change differences

The diff is a safety tool. It should not write anything.

## Bundle Prune

`bundle prune` removes redundant or non-restorable data from a snapshot.
It should prune:
- duplicate empty sections
- repeated host entries
- regenerable noise that does not belong in restore
- fields known to be unstable across runs

Prune should keep the snapshot valid and portable after cleanup.

## Data Flow

1. The user runs `backup`.
2. The CLI reads the current repo state and serializes it into a bundle.
3. The bundle is validated and written to disk.
4. The user runs `bundle validate` or `bundle diff` if they want a safety check.
5. The user runs `restore` with a chosen bundle.
6. `restore` validates the bundle, writes the state back, and then runs repo validation.

## Error Handling

The implementation must fail closed:
- If backup cannot resolve a complete state, it must refuse to write a partial bundle.
- If restore sees an invalid bundle, it must stop before writing anything.
- If restore writes a bundle and validation fails, it must report the failure clearly.
- If host-specific data is ambiguous, the restore must not guess.
- If a required path does not exist in the source state, the command should surface the missing path rather than masking it.

## Verification

The feature is complete only when all of these pass:
- backup creates a valid snapshot from the current repo state
- restore round-trips the snapshot into a clean workspace
- bundle validate rejects malformed or incomplete bundles
- bundle diff shows meaningful differences without writing
- bundle prune removes redundant noise without breaking restore
- validation and lint pass after restore

## Non-Goals

This version does not:
- replace git as the source of history
- add cloud sync
- add binary compression formats as the only export mechanism
- change the host-scoped memory model
- alter the meaning of change gating or memory learning

## Expected Outcome

After this update, `agent-system` can be snapshotted and restored as a complete mutable state package. The recovery path should be portable, explicit, and safe enough to move the repo between devices or workspaces without losing host-specific memory or delivery state.
