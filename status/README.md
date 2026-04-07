# Status Bus

This directory stores live agent presence for terminal rendering and lightweight tooling.

## Files

- `current.json` stores the active presence snapshot.
- `events.jsonl` stores append-only presence updates.

## Current snapshot fields

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

## Canonical render

`[AGENT] <name> | <action> | <elapsed>`

Optional fields may be appended for richer rendering:

- scope
- task
- route
- profile
- eta
- state

## Usage

- `status set` writes the current snapshot and appends an event.
- `status show` renders the current snapshot.
- `status who` prints the active session summary.
- `status heartbeat` refreshes `updatedAt` without changing the message.
- `status attach` binds the current session to a task and route.
- `status watch` watches the snapshot and renders the current line.
- `status clear` marks the presence as inactive.
- `status list` shows recent events.
