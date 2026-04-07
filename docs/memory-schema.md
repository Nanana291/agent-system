# Memory Schema

The memory layer is intentionally layered, not flat.

## Files

- `memory/system.md`
- `memory/profile/<profile>.md`
- `memory/host/generic.md`
- `memory/host/claude.md`
- `memory/host/codex.md`
- `memory/host/qwen.md`

## Write policy

- System memory: durable rules that apply across profiles and hosts.
- Profile memory: durable lessons for one profile only.
- Host memory: adaptation notes that depend on host behavior.

## Promotion rule

When a mistake occurs:

1. Record the smallest valid rule first.
2. Promote it only if the same mistake would recur at a wider scope.
3. Keep the human-facing docs in sync with the durable memory source.
