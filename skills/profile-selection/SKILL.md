---
name: profile-selection
description: Choose the active profile from the repository context, host context, and explicit user request.
---

# Profile Selection

Use this skill when the system needs to decide which profile pack is active.

## Selection Order

1. Explicit user choice.
2. Repository-local profile marker.
3. Host or workspace context.
4. Default universal fallback.

## Output

Return:

- `selectedProfile`
- `selectionReason`
- `host`
- `confidence`
- `fallbackUsed`

## Rules

- Prefer the profile declared by the workspace over guesses.
- If more than one profile fits, explain the tie-breaker.
- Do not mix profile data from unrelated packs.
- If no profile is available, return the universal fallback instead of inventing one.

