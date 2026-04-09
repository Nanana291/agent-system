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

<!-- agent-system-upgrade-start -->
## Upgrade Sync

Generated: 2026-04-09T23:32:33.022Z
Profile: imphub
Host focus: qwen
Mode: sync
Outcome: synced
Agents upgraded: 11
Learned: 11
Reinforced: 0
Blocked: 0
Target: /storage/emulated/0/Download/work/agent-system/AGENTS.md

### Scriptmaster (logic)
- Status: new
- Confidence: 84
- Lesson: Keep selector, dispatcher, and recovery ownership explicit.
- Evidence: Task flow, runtime behavior, remotes, selectors, and action dispatch.
- Keep selector, dispatcher, and recovery ownership explicit.
- Preserve baseline and regression proof for existing-script updates.
- Call out post-autoload runtime re-sync when derived state changes.
- Host sync target: qwen.

### Ui Designer (ui)
- Status: new
- Confidence: 84
- Lesson: Keep visible wording, ToolTip coverage, and gated visibility aligned.
- Evidence: LibSixtyTen layout, visible status text, section structure, and control grouping.
- Keep visible wording, ToolTip coverage, and gated visibility aligned.
- Use status labels that match the user-facing intent first.
- Document old -> new flag mappings when UI labels move.
- Host sync target: qwen.

### Feature Framer (framing)
- Status: new
- Confidence: 84
- Lesson: Make child controls read like subordinate actions, modes, or fallbacks.
- Evidence: Parent-child meaning for new master-toggle groups.
- Make child controls read like subordinate actions, modes, or fallbacks.
- Do not force separate product names for dependent controls.
- Preserve the parent-child mental model in the visible wording.
- Host sync target: qwen.

### Terminology Keeper (terminology)
- Status: new
- Confidence: 84
- Lesson: Keep visible names stable across pages for the same concept.
- Evidence: Visible labels, status wording, and cross-page naming consistency.
- Keep visible names stable across pages for the same concept.
- Reject GPT-like labels that sound generic or inflated.
- Only introduce synonyms when they improve comprehension.
- Host sync target: qwen.

### Executor Specialist (compat)
- Status: new
- Confidence: 84
- Lesson: Fail closed on unsupported executor paths.
- Evidence: Executor gating, unsupported-path detection, and platform compatibility.
- Fail closed on unsupported executor paths.
- Keep compatibility gates and unsupported-path notes explicit.
- Do not assume host-native features exist without proof.
- Host sync target: qwen.

### Lifecycle Manager (lifecycle)
- Status: new
- Confidence: 84
- Lesson: Preserve rebinds, respawn paths, and loop ownership boundaries.
- Evidence: Respawn, character rebinds, and long-lived connection ownership.
- Preserve rebinds, respawn paths, and loop ownership boundaries.
- Never leave long-lived state without an owner contract.
- Keep recovery and attachment paths explicit.
- Host sync target: qwen.

### Update Steward (update)
- Status: new
- Confidence: 84
- Lesson: Preserve the allowed update scope and preserve-list features.
- Evidence: Existing-script update scope and preserve-list features.
- Preserve the allowed update scope and preserve-list features.
- Keep additive changes inside the existing owner path first.
- State the old -> new runtime map when ownership moves.
- Host sync target: qwen.

### Config Keeper (config)
- Status: new
- Confidence: 84
- Lesson: Keep ownership explicit.
- Evidence: Persistence, migration, and autoload synchronization.
- Keep ownership explicit.
- Capture the durable lesson in the right host memory.
- Prefer additive, reversible upgrades over broad rewrites.
- Host sync target: qwen.

### Drawing Artist (esp)
- Status: new
- Confidence: 84
- Lesson: Keep ownership explicit.
- Evidence: Drawing API overlays and ESP rendering.
- Keep ownership explicit.
- Capture the durable lesson in the right host memory.
- Prefer additive, reversible upgrades over broad rewrites.
- Host sync target: qwen.

### Optimizer (optimization)
- Status: new
- Confidence: 84
- Lesson: Keep register pressure, memory churn, and connection cleanup in view.
- Evidence: Performance, register pressure, memory, and connection cleanup.
- Keep register pressure, memory churn, and connection cleanup in view.
- Avoid decorative helper layers that do not reduce risk or cost.
- State ownership must remain explicit for long-lived loops.
- Host sync target: qwen.

### Qa Inspector (regression-proof)
- Status: new
- Confidence: 84
- Lesson: Anchor delivery on a baseline and a clear regression matrix.
- Evidence: Baseline comparison, regression matrices, and delivery gates.
- Anchor delivery on a baseline and a clear regression matrix.
- Call out touched vs untouched paths before delivery closes.
- Block on missing proof instead of soft-approving the change.
- Host sync target: qwen.

### Host Sync
- claude: memory and instructions synced from the same upgrade pass.
- codex: memory and instructions synced from the same upgrade pass.
- qwen: memory and instructions synced from the same upgrade pass.
- opencode: memory and instructions synced from the same upgrade pass.
<!-- agent-system-upgrade-end -->

<!-- agent-system-training-start -->
## Training Sync

Generated: 2026-04-09T23:32:43.161Z
Profile: imphub
Host focus: qwen
Mode: success
Outcome: applied
Agents trained: 12

### Scriptmaster
- Role: scriptmaster
- Domain: logic
- Task flow, runtime behavior, remotes, selectors, and action dispatch.
- Keep ownership explicit and preserve baseline proof when the domain changes.

### Ui Designer
- Role: ui-designer
- Domain: ui
- LibSixtyTen layout, visible status text, section structure, and control grouping.
- Keep ownership explicit and preserve baseline proof when the domain changes.

### Feature Framer
- Role: feature-framer
- Domain: framing
- Parent-child meaning for new master-toggle groups.
- Keep ownership explicit and preserve baseline proof when the domain changes.

### Terminology Keeper
- Role: terminology-keeper
- Domain: terminology
- Visible labels, status wording, and cross-page naming consistency.
- Keep ownership explicit and preserve baseline proof when the domain changes.

### Executor Specialist
- Role: executor-specialist
- Domain: compat
- Executor gating, unsupported-path detection, and platform compatibility.
- Keep ownership explicit and preserve baseline proof when the domain changes.

### Lifecycle Manager
- Role: lifecycle-manager
- Domain: lifecycle
- Respawn, character rebinds, and long-lived connection ownership.
- Keep ownership explicit and preserve baseline proof when the domain changes.

### Update Steward
- Role: update-steward
- Domain: update
- Existing-script update scope and preserve-list features.
- Keep ownership explicit and preserve baseline proof when the domain changes.

### Config Keeper
- Role: config-keeper
- Domain: config
- Persistence, migration, and autoload synchronization.
- Keep ownership explicit and preserve baseline proof when the domain changes.

### Drawing Artist
- Role: drawing-artist
- Domain: esp
- Drawing API overlays and ESP rendering.
- Keep ownership explicit and preserve baseline proof when the domain changes.

### Optimizer
- Role: optimizer
- Domain: optimization
- Performance, register pressure, memory, and connection cleanup.
- Keep ownership explicit and preserve baseline proof when the domain changes.

### Qa Inspector
- Role: qa-inspector
- Domain: regression-proof
- Baseline comparison, regression matrices, and delivery gates.
- Keep ownership explicit and preserve baseline proof when the domain changes.

### Architecture Reviewer
- Role: architecture-reviewer
- Domain: review
- Review the training block for proof, consistency, and missing guardrails.
- Block on drift between the structured profile and the human-facing docs.

### Learning Rule
- Training lesson: keep Scriptmaster, Ui Designer, Feature Framer, Terminology Keeper aligned with the active profile, preserve the owned domains, and mirror durable notes into qwen memory. Source mode: idle.

### Host Sync
- qwen: training lessons and memory are synchronized from this pass.
<!-- agent-system-training-end -->
