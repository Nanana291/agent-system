# Imp Hub X Profile

This profile pack is the human-facing companion to `profiles/imphub/profile.json`.
When the two differ, the JSON file is authoritative.

## Authority Split

- Superpowers decides how work is approached.
- Agent System decides route, ownership, handoff, and delivery proof.
- This profile defines the Imp Hub X domain map and the profile-specific route families.

## Profile Scope

The `imphub` profile covers the task families used by Imp Hub X:

- feature additions on existing scripts
- new integrations
- full rewrites and migrations
- boss phase and HP threshold logic
- farm loops
- combat and silent aim work
- ESP and drawing work
- UI sections and UI-system rewrites
- webhook edits
- executor detection and compatibility work
- config persistence and migration
- character lifecycle and respawn work
- register-budget fixes
- code review and performance passes

## Route Families

| Task type | Route outcome | Primary domains |
|---|---|---|
| `new-game-integration` | Scout, lifecycle, compat, logic, review | logic, compat, lifecycle, regression-proof |
| `feature-addition` | Update-first existing-script path | update, lifecycle, logic, ui, regression-proof |
| `full-rewrite-migration` | Migration-first rewrite path | migration, ui, logic, compat, regression-proof |
| `boss-phases-hp-thresholds` | Boss strategy path | logic, optimization, regression-proof |
| `farm-loop-single-mode` | Single-mode farm path | logic, lifecycle, optimization, regression-proof |
| `farm-loop-multi-mode` | Multi-mode farm path | logic, lifecycle, optimization, regression-proof |
| `kill-aura-combat` | Combat path | logic, optimization, regression-proof |
| `silent-aim` | Silent-aim path | compat, logic, regression-proof |
| `esp-drawing` | Drawing path | esp, compat, optimization |
| `ui-system-rewrite` | UI maker path | ui-system, ui, framing, terminology, regression-proof |
| `ui-sections-status` | UI designer path | ui, terminology, framing, regression-proof |
| `webhook-create-edit` | Webhook path | ui, config, regression-proof |
| `executor-detection-gating` | Compat gating path | compat, regression-proof |
| `remote-blocking-arg-modification` | Interception path | logic, compat, regression-proof |
| `fps-boost-toggle` | Performance toggle path | optimization, ui |
| `macro-recording-replay` | Macro lifecycle path | lifecycle, ui, optimization |
| `config-persistence-migration` | Config migration path | config, compat |
| `character-lifecycle-respawn` | Respawn path | lifecycle, regression-proof |
| `register-budget-fix` | Budget-surgery path | optimization, ui, logic |
| `code-review-performance-pass` | Review-only path | optimization, regression-proof |

## Ownership Rules

- One active domain has one owner.
- Existing-script updates keep untouched domains stable.
- UI wording changes are owned by the UI and terminology domains, not by logic.
- Compatibility changes must call out unsupported executor paths explicitly.
- Regression-proof work must name the baseline or equivalent reference.

## Required Artifacts

Every routed task should produce:

- `[TASK LOCK]`
- `[HANDOFF]`
- `[DELIVERY GATE]`
- a regression matrix when existing work is touched

## Review Agents

The profile ships two reusable review agents:

- `qa-inspector` for gate compliance, regression risk, and proof checks
- `architecture-reviewer` for route structure, boundaries, and host compatibility

The profile also relies on the universal orchestration skills:

- `agent-routing`
- `domain-ownership`
- `delivery-gating`
- `profile-selection`
- `artifact-enforcement`

## Host Notes

- Claude, Codex, and Qwen all consume the same structured profile.
- Host-specific behavior stays thin and should degrade to markdown artifacts when a capability is missing.
- The profile data stays stable even if a host cannot execute every command form.
