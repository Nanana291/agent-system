# Luau Auto Repair Design

## Goal

Build a Luau-focused repair loop that explains routing decisions, diagnoses Luau-specific failures, and applies multi-file repairs automatically when the signal is clear.

This release is intentionally larger than a fast path. It is meant to reduce Luau regressions and repeated mistakes by coupling diagnosis, repair, and learning in one flow.

## Scope

In scope:

- `luau-explain` for route reasoning and risk explanation
- `luau-diagnose` for Luau-specific failure detection
- `luau-repair` for automatic multi-file repair
- `luau-gate` for post-repair validation and blocker reporting
- automatic writes to code, config, memory, docs, and `AGENTS.md` when the repair changes behavior or teaching
- automatic follow-up learning through `train` and `eval`

Out of scope:

- non-Luau language-specific repair logic
- interactive review-only repair mode for this release
- new profile packs or new host adapters
- manual approval gates for the primary repair path

## Design

### `luau-explain`

This command explains why a Luau task was routed to a particular path.

It should report:

- active host and profile
- selected path: `quick-fix`, `luau-quick`, `train`, `eval`, or `luau-repair`
- why the task was considered Luau-relevant
- what risk level was inferred
- what proof is required before the repair is considered valid

### `luau-diagnose`

This command scans the current workspace and returns a structured Luau diagnosis.

It should detect common failure classes:

- hot-path `WaitForChild`
- remote calls missing `pcall`
- lifecycle or connection cleanup gaps
- state ownership drift
- missing fallback or invalid target resolution
- small multi-file mismatches caused by partial repairs

The diagnosis becomes the source signal for repair selection and for the learning loop.

### `luau-repair`

This command applies an automatic repair when diagnosis confidence is high enough.

Repair behavior:

- may touch multiple source files
- may update `memory/` when the fix is durable
- may update `docs/` when the contract or behavior changes
- may update `AGENTS.md` when the agent guidance or route contract changes
- must preserve untouched behavior unless the diagnosis explicitly justifies a broader change

The repair should be deterministic for the same diagnosis input.

### `luau-gate`

This command validates that the repair is internally consistent and safe to land.

It should verify:

- changed files were actually touched by the repair
- memory and docs updates match the new behavior
- `AGENTS.md` and the structured manifests do not contradict each other
- no stop-line risks remain unresolved

## Data Flow

1. A Luau-relevant change or execution is detected.
2. `luau-explain` classifies the path and explains the decision.
3. `luau-diagnose` produces a structured diagnosis.
4. `luau-repair` writes the code and supporting artifacts.
5. `luau-gate` validates the result.
6. `train` and `eval` capture the resulting lessons automatically.

## Error Handling

- If diagnosis confidence is too low, `luau-repair` must stop and report the blocker.
- If a repair would contradict `AGENTS.md` or profile ownership, the change must stop.
- If `memory/`, `docs/`, or `AGENTS.md` are required but not updated, the gate fails.
- If the repair introduces multi-file drift, the gate blocks delivery until the drift is resolved.

## Verification

The implementation must be covered by tests that prove:

- `luau-explain` reports the selected path and Luau risk
- `luau-diagnose` detects Luau hot-path and lifecycle issues
- `luau-repair` can update multiple files from one diagnosis
- `luau-gate` blocks incomplete or inconsistent repairs
- the Luau learning loop captures lessons after a repair

## Release Shape

This release is intended to be a large update because it changes the system from:

- fast Luau fixes only

to:

- explainable Luau routing
- automatic Luau diagnosis
- automatic multi-file Luau repair
- automatic Luau learning after repair

