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

When `change gate` passes or blocks, it appends a note to `memory/change/<profile>.md`. Stable lessons can be promoted later with `memory promote`.
