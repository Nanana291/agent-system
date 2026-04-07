# Memory Layer

This directory holds durable agent memory in layers:

- `system.md` for repository-wide durable rules
- `profile/<profile>.md` for profile-specific lessons
- `host/generic.md` for host-agnostic adaptation notes
- `host/<host>.md` for host-specific behavior

The rule is simple:

1. Write the narrowest file that fits the rule.
2. Promote outward only when the rule is durable at a wider scope.
3. Keep host memory separate from profile memory.
