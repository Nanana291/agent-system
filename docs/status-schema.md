# Status Schema

The status bus is a simple, universal presence layer.

## current.json

Fields:

- `agent`
- `name`
- `action`
- `state`
- `scope`
- `task`
- `route`
- `profile`
- `attachedAt`
- `heartbeatAt`
- `startedAt`
- `updatedAt`
- `eta`
- `detail`
- `active`

## events.jsonl

Each line is a JSON object with the same fields as `current.json`, plus:

- `eventType`
- `sequence`

## Rendering rule

The canonical terminal line is:

`[AGENT] <name> | <action> | <elapsed>`

Helpful extras:

- scope
- task
- route
- profile
- eta
- state

## Durability rule

Use `status/current.json` for the live view, and `status/events.jsonl` for history.
