# agent-system.mjs Baseline

## Script Identity

- Path: `bin/agent-system.mjs`
- Role: universal orchestration CLI
- Focus: validation, routing, memory, status, and change workflow support

## Current Baseline Notes

- `validate` checks the active profile, status files, and change files.
- `lint` enforces manifest consistency, memory drift checks, status presence, and change presence.
- `status` owns presence, heartbeat, and session attachment.
- `change` owns intake analysis, scaffold generation, and gate validation.

## Verification Targets

- `node ./bin/agent-system.mjs validate`
- `node ./bin/agent-system.mjs lint`
- `node --test tests/status-cli.test.mjs`
- `node --test tests/change-cli.test.mjs`
