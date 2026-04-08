---
description: Classify the task, pick the active profile route, and list required skills and artifacts
---

Use the repository's active profile as the source of truth.

Work in this order:

1. Identify the active profile.
2. Classify the task impact.
3. Match the best task type from the profile.
4. Return the selected route, ordered agents, required skills, required artifacts, and stop-line risks.
5. If no exact task type matches, say so and explain the fallback used.

If the task is about release proof rather than feature routing, mention the executable check that closes it.

Return a compact routing block with:

- `profile`
- `taskType`
- `changeClassification`
- `selectedRoute`
- `orderedAgents`
- `requiredSkills`
- `requiredArtifacts`
- `stopLineRisks`

Task input:
{{args}}
