# Imp Hub X Profile

This profile pack is the human-facing companion to `profiles/imphub/profile.json`.
When the two differ, the JSON file is authoritative.

## Authority Split

- Superpowers decides how work is approached.
- Agent System decides route, ownership, handoff, and delivery gates.
- This profile defines the Imp Hub X domain map and the profile-specific route families.

## Profile Scope

The `imphub` profile covers the task families defined in the manifest.

- New Game Integration (`new-game-integration`) - tags: logic, compat, lifecycle, regression-risk
- Feature Addition (`feature-addition`) - tags: logic, ui, update, regression-risk
- Full Rewrite Migration (`full-rewrite-migration`) - tags: migration, ui, logic, regression-risk
- Boss Phases Hp Thresholds (`boss-phases-hp-thresholds`) - tags: logic, optimization
- Farm Loop Single Mode (`farm-loop-single-mode`) - tags: logic, lifecycle, optimization
- Farm Loop Multi Mode (`farm-loop-multi-mode`) - tags: logic, lifecycle, optimization
- Kill Aura Combat (`kill-aura-combat`) - tags: logic, optimization, regression-risk
- Silent Aim (`silent-aim`) - tags: silent-aim, compat, regression-risk
- Esp Drawing (`esp-drawing`) - tags: esp, ui, optimization
- Ui System Rewrite (`ui-system-rewrite`) - tags: ui-system, ui, framing, terminology, regression-risk
- Ui Sections Status (`ui-sections-status`) - tags: ui, terminology, regression-risk
- Webhook Create Edit (`webhook-create-edit`) - tags: ui, config, regression-risk
- Executor Detection Gating (`executor-detection-gating`) - tags: compat, regression-risk
- Remote Blocking Arg Modification (`remote-blocking-arg-modification`) - tags: logic, compat, regression-risk
- Fps Boost Toggle (`fps-boost-toggle`) - tags: optimization, ui
- Macro Recording Replay (`macro-recording-replay`) - tags: lifecycle, ui, optimization
- Config Persistence Migration (`config-persistence-migration`) - tags: config, migration, compat
- Character Lifecycle Respawn (`character-lifecycle-respawn`) - tags: lifecycle, regression-risk
- Register Budget Fix (`register-budget-fix`) - tags: optimization, ui, regression-risk
- Code Review Performance Pass (`code-review-performance-pass`) - tags: optimization, regression-risk

## Route Families

| Task type | Route | Primary domains |
|---|---|---|
| `new-game-integration` | `scout -> lifecycle-manager -> executor-specialist -> scriptmaster -> ghost-or-sentinel -> architecture-reviewer -> ui-designer -> config-keeper -> optimizer -> qa-inspector` | logic, compat, lifecycle, regression-risk |
| `feature-addition` | `update-steward -> lifecycle-manager -> scriptmaster -> ghost-or-sentinel -> architecture-reviewer -> executor-specialist -> ui-designer -> feature-framer -> terminology-keeper -> optimizer -> qa-inspector` | logic, ui, update, regression-risk |
| `full-rewrite-migration` | `migration-architect -> lifecycle-manager -> scriptmaster -> ui-designer -> terminology-keeper -> ghost-or-sentinel -> executor-specialist -> architecture-reviewer -> optimizer -> qa-inspector` | migration, ui, logic, regression-risk |
| `boss-phases-hp-thresholds` | `boss-strategist -> scriptmaster -> ghost-or-sentinel -> optimizer -> qa-inspector` | logic, optimization |
| `farm-loop-single-mode` | `lifecycle-manager -> scriptmaster -> ghost-or-sentinel -> recovery-specialist -> architecture-reviewer -> optimizer -> qa-inspector` | logic, lifecycle, optimization |
| `farm-loop-multi-mode` | `lifecycle-manager -> scriptmaster -> ghost-or-sentinel -> recovery-specialist -> architecture-reviewer -> optimizer -> qa-inspector` | logic, lifecycle, optimization |
| `kill-aura-combat` | `scriptmaster -> ghost-or-sentinel -> recovery-specialist -> architecture-reviewer -> optimizer -> qa-inspector` | logic, optimization, regression-risk |
| `silent-aim` | `sharpshooter -> executor-specialist -> ghost -> architecture-reviewer -> ui-designer -> optimizer -> qa-inspector` | silent-aim, compat, regression-risk |
| `esp-drawing` | `drawing-artist -> executor-specialist -> optimizer -> qa-inspector` | esp, ui, optimization |
| `ui-system-rewrite` | `ui-maker -> terminology-keeper -> feature-framer -> optimizer -> qa-inspector` | ui-system, ui, framing, terminology, regression-risk |
| `ui-sections-status` | `ui-designer -> terminology-keeper -> feature-framer -> architecture-reviewer -> optimizer -> qa-inspector` | ui, terminology, regression-risk |
| `webhook-create-edit` | `ui-designer -> optimizer -> qa-inspector` | ui, config, regression-risk |
| `executor-detection-gating` | `executor-specialist -> qa-inspector` | compat, regression-risk |
| `remote-blocking-arg-modification` | `interceptor -> executor-specialist -> optimizer -> qa-inspector` | logic, compat, regression-risk |
| `fps-boost-toggle` | `fps-architect -> executor-specialist -> ui-designer -> optimizer -> qa-inspector` | optimization, ui |
| `macro-recording-replay` | `macro-architect -> lifecycle-manager -> ui-designer -> optimizer -> qa-inspector` | lifecycle, ui, optimization |
| `config-persistence-migration` | `config-keeper -> executor-specialist -> qa-inspector` | config, migration, compat |
| `character-lifecycle-respawn` | `lifecycle-manager -> optimizer -> qa-inspector` | lifecycle, regression-risk |
| `register-budget-fix` | `register-budget-surgeon -> ui-designer -> scriptmaster -> optimizer -> qa-inspector` | optimization, ui, regression-risk |
| `code-review-performance-pass` | `optimizer -> qa-inspector` | optimization, regression-risk |

## Ownership Rules

- One active domain has one owner.
- Existing-script updates keep untouched domains stable.
- UI wording changes are owned by the UI and terminology domains, not by logic.
- Compatibility changes must call out unsupported executor paths explicitly.
- Regression-proof work must name the baseline or equivalent reference.

## Required Artifacts

- `task-lock`
- `handoff`
- `delivery-gate`
- `regression-matrix`

## Review Agents

- `qa-inspector`
- `architecture-reviewer`

## Route Fallbacks

| Classification | Fallback task type |
|---|---|
| `logic` | `feature-addition` |
| `ui` | `ui-sections-status` |
| `compat` | `executor-detection-gating` |
| `migration` | `full-rewrite-migration` |
| `regression-risk` | `code-review-performance-pass` |

## Host Notes

- Claude, Codex, and Qwen all consume the same structured profile.
- Host-specific behavior stays thin and should degrade to markdown artifacts when a capability is missing.
- The profile data stays stable even if a host cannot execute every command form.
