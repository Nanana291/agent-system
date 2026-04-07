# Change Schema

The change workflow stores a compact intake for updates and new-project bootstraps.

## current.json fields

- `type`
- `name`
- `target`
- `intent`
- `processSkill`
- `routeSelected`
- `classification`
- `ownedDomains`
- `baselineFile`
- `regressionMatrix`
- `oldNewMapping`
- `stopLineRisks`
- `sourceFiles`
- `ready`
- `state`
- `createdAt`
- `scoutedAt`
- `scaffoldedAt`
- `updatedAt`
- `gatedAt`
- `profile`

## Gate rule

`change gate` is ready only when the intake has a target, an intent, a classification, owned domains, and the update-specific proof fields required by the change type.

## Automatic memory capture

When `change gate` passes or blocks, it appends a note to `memory/change/<host>.md`. Stable lessons stay inside the active host boundary unless they clearly belong to that host long term.
The gate also records a host reflection note so the next review pass can compress or teach the lesson without mixing hosts.

## Self-learning loop

When `change gate` passes, it also runs `memory learn` so repeated change lessons can be promoted into the active host's memory file automatically.
The host refinement loop then uses `memory review`, `memory compress`, `memory teach`, `memory gate`, `memory reflect`, and `memory packs` to keep that host's memory compact before promotion.
