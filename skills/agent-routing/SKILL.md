---
name: agent-routing
description: Classify a task, select the profile route, and return the ordered agent stages with required skills and artifacts.
---

# Agent Routing

Use this skill when a task needs a route decision.

## Output

Return a compact routing block with:

- `profile`
- `taskType`
- `changeClassification`
- `selectedRoute`
- `orderedAgents`
- `requiredSkills`
- `requiredArtifacts`
- `stopLineRisks`

## Rules

- Prefer an exact task-type match over tag-only fallback.
- Fall back to the profile's generic route only when no task type matches.
- Do not invent agents that are not listed in the active profile.
- Keep route selection deterministic and explain the fallback if used.
- If the task touches multiple domains, preserve the route order from the profile instead of reordering it ad hoc.

