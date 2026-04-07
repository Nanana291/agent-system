---
name: domain-ownership
description: Assign each active domain to one owner, define what cannot change next, and emit a handoff that preserves control boundaries.
---

# Domain Ownership

Use this skill when a task changes logic, UI, compat, migration, or regression-proof domains.

## Output

Return a handoff block with:

- `owner`
- `changed`
- `locked`
- `risks`
- `nextAgent`
- `proofTarget`
- `regressionImpact`

## Rules

- One domain has one owner at a time.
- Do not silently rewrite another agent's domain.
- If ownership changes, call it out explicitly.
- Preserve untouched domains by default.
- If a live owner path must move, state why the old path cannot remain additive.

