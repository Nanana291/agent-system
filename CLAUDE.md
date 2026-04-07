# Claude Code Bootstrap

Use this repo as the execution layer on top of Superpowers.

- Superpowers decides the process.
- Agent System decides route selection, domain ownership, handoffs, and delivery gates.
- `agent-system.json` is the first structured source to read.
- Prefer profile manifests over freeform reasoning when a route, owner, or gate is already defined.

## Working rule

When a task touches an existing profile or route, keep the structured artifacts aligned and emit the required markdown gate documents instead of inventing a new workflow.

## Fallback rule

If a host capability is missing, degrade to the root docs and artifact templates rather than changing the contract.
