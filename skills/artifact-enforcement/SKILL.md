---
name: artifact-enforcement
description: Verify that the required routing artifacts exist and match the current task stage before allowing delivery.
---

# Artifact Enforcement

Use this skill when a task needs structured proof.

## Required Artifacts

Check for the artifacts required by the active profile, usually:

- task lock
- handoff
- delivery gate
- regression matrix

## Rules

- If an artifact is required, it must be emitted in the correct shape.
- A missing artifact is a blocker, not a suggestion.
- For existing work, the baseline or regression source must be named.
- For rewrites or migrations, the old-to-new mapping must be explicit.
- Do not mark a task complete until the required artifacts are present and consistent.

