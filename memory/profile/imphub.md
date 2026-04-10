# Imp Hub X Memory

Durable lessons and preferences for the `imphub` profile live here.

## Usage

- Record profile-specific rule fixes here first.
- Mirror only durable host-independent rules into `memory/system.md`.
- Mirror host-specific adaptations into `memory/host/<host>.md` when needed.
- When a mistake has a clear fix and prevention rule, record it here before promoting it outward.

## Initial profile memory

- Keep route families stable unless the profile manifest changes.
- Do not silently move ownership between domains without a handoff.
- Existing-script updates must preserve untouched domains by default.

<!-- agent-system-upgrade-start -->
# Agent Upgrade Sync

Scope: profile
Name: imphub
Generated: 2026-04-10T09:13:23.368Z
Mode: apply
Outcome: learned
Agents upgraded: 11
Learned: 0
Reinforced: 11
Blocked: 0

## Scriptmaster (logic)
- Status: reinforced
- Confidence: 89
- Lesson: Keep selector, dispatcher, and recovery ownership explicit.
- Evidence: Task flow, runtime behavior, remotes, selectors, and action dispatch.
- Keep selector, dispatcher, and recovery ownership explicit.
- Preserve baseline and regression proof for existing-script updates.
- Call out post-autoload runtime re-sync when derived state changes.
- Host sync target: qwen.

## Ui Designer (ui)
- Status: reinforced
- Confidence: 89
- Lesson: Keep visible wording, ToolTip coverage, and gated visibility aligned.
- Evidence: LibSixtyTen layout, visible status text, section structure, and control grouping.
- Keep visible wording, ToolTip coverage, and gated visibility aligned.
- Use status labels that match the user-facing intent first.
- Document old -> new flag mappings when UI labels move.
- Host sync target: qwen.

## Feature Framer (framing)
- Status: reinforced
- Confidence: 89
- Lesson: Make child controls read like subordinate actions, modes, or fallbacks.
- Evidence: Parent-child meaning for new master-toggle groups.
- Make child controls read like subordinate actions, modes, or fallbacks.
- Do not force separate product names for dependent controls.
- Preserve the parent-child mental model in the visible wording.
- Host sync target: qwen.

## Terminology Keeper (terminology)
- Status: reinforced
- Confidence: 89
- Lesson: Keep visible names stable across pages for the same concept.
- Evidence: Visible labels, status wording, and cross-page naming consistency.
- Keep visible names stable across pages for the same concept.
- Reject GPT-like labels that sound generic or inflated.
- Only introduce synonyms when they improve comprehension.
- Host sync target: qwen.

## Executor Specialist (compat)
- Status: reinforced
- Confidence: 89
- Lesson: Fail closed on unsupported executor paths.
- Evidence: Executor gating, unsupported-path detection, and platform compatibility.
- Fail closed on unsupported executor paths.
- Keep compatibility gates and unsupported-path notes explicit.
- Do not assume host-native features exist without proof.
- Host sync target: qwen.

## Lifecycle Manager (lifecycle)
- Status: reinforced
- Confidence: 89
- Lesson: Preserve rebinds, respawn paths, and loop ownership boundaries.
- Evidence: Respawn, character rebinds, and long-lived connection ownership.
- Preserve rebinds, respawn paths, and loop ownership boundaries.
- Never leave long-lived state without an owner contract.
- Keep recovery and attachment paths explicit.
- Host sync target: qwen.

## Update Steward (update)
- Status: reinforced
- Confidence: 89
- Lesson: Preserve the allowed update scope and preserve-list features.
- Evidence: Existing-script update scope and preserve-list features.
- Preserve the allowed update scope and preserve-list features.
- Keep additive changes inside the existing owner path first.
- State the old -> new runtime map when ownership moves.
- Host sync target: qwen.

## Config Keeper (config)
- Status: reinforced
- Confidence: 89
- Lesson: Keep ownership explicit.
- Evidence: Persistence, migration, and autoload synchronization.
- Keep ownership explicit.
- Capture the durable lesson in the right host memory.
- Prefer additive, reversible upgrades over broad rewrites.
- Host sync target: qwen.

## Drawing Artist (esp)
- Status: reinforced
- Confidence: 89
- Lesson: Keep ownership explicit.
- Evidence: Drawing API overlays and ESP rendering.
- Keep ownership explicit.
- Capture the durable lesson in the right host memory.
- Prefer additive, reversible upgrades over broad rewrites.
- Host sync target: qwen.

## Optimizer (optimization)
- Status: reinforced
- Confidence: 89
- Lesson: Keep register pressure, memory churn, and connection cleanup in view.
- Evidence: Performance, register pressure, memory, and connection cleanup.
- Keep register pressure, memory churn, and connection cleanup in view.
- Avoid decorative helper layers that do not reduce risk or cost.
- State ownership must remain explicit for long-lived loops.
- Host sync target: qwen.

## Qa Inspector (regression-proof)
- Status: reinforced
- Confidence: 89
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
- Host sync target: qwen.

<!-- agent-system-upgrade-end -->

<!-- agent-system-training-start -->
## Agent Training Sync

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
