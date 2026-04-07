# Memory Schema

The memory layer is intentionally flat and host-scoped.

## Files

- `memory/host/claude.md`
- `memory/host/codex.md`
- `memory/host/qwen.md`
- `memory/packs/claude.md`
- `memory/packs/codex.md`
- `memory/packs/qwen.md`

## Write policy

- Claude memory stores durable Claude-specific lessons.
- Codex memory stores durable Codex-specific lessons.
- Qwen memory stores durable Qwen-specific lessons.

## Promotion rule

When a mistake occurs:

1. Record the smallest valid rule in the active host file first.
2. Promote it only if the same host would benefit from seeing it again.
3. Keep the host file as the source of truth for that host.

## Maintenance verbs

- `memory search` finds rules by text.
- `memory promote` moves a rule inside the active host boundary.
- `memory learn` auto-promotes repeated change lessons into the active host memory file.
- `memory review` finds duplicates and weak notes for the active host.
- `memory compress` rewrites the active host change memory into a compact host-local trail.
- `memory teach` promotes compact host lessons into the active host memory file.
- `memory gate` blocks weak notes from becoming durable host memory.
- `memory reflect` appends a short host-local reflection note after a change gate.
- `memory packs` generates or lists the compact host learning pack.
- `memory prune` removes duplicate blank or repeated entries.
- `memory audit` checks host drift and scope conflicts.
- `memory stats` reports file and entry counts for the host memory tree.
