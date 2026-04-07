---
name: delivery-gating
description: Validate the delivery gate, required proof, and blocker state before work is marked complete.
---

# Delivery Gating

Use this skill when a task is ready for final review or release.

## Output

Return a delivery gate block with:

- `baselineUpdated`
- `regressionMatrix`
- `oldToNewMapping`
- `ownedDomainsClosed`
- `openRisks`
- `blockedOrReady`

## Rules

- Delivery is blocked if a required artifact is missing.
- Existing work needs a baseline or equivalent regression reference.
- Rewrites and migrations need an old-to-new mapping.
- Never downgrade a blocker into a note.
- Be explicit about what remains open if the gate is not ready.

