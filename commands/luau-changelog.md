---
description: Generate Luau release notes from a baseline comparison. Links feature changes, brain entries, risk score trends, and delivery proof into a readable changelog.
---

Generate human-readable release notes for a Luau script change.

## Input

{{args}}

Accepts:
- Two paths: `<baseline-path> <current-path>`
- A game name + V2 path: `--game <name> --target <path>`
- A directory slice: `--target <dir>`

## Sources

Build the changelog from:

1. **Diff summary** — lines added/removed, functions added/modified/removed
2. **Feature parity** — features lost, added, modified, degraded (from luau-feature-diff patterns)
3. **Risk score trend** — previous score vs current score
4. **Remote changes** — new remotes, removed remotes, pcall additions
5. **Brain links** — any brain entries created during this change session
6. **Safety changes** — circuit breaker additions, character rebind additions, loop fixes
7. **UI changes** — new sections, renamed controls, status paragraph additions
8. **Config changes** — new config options, save/load modifications

## Output Format

```
# Changelog: <Game/Script Name>

## [<version>] — <date>

### Verdict: <PARITY / ACCEPTABLE / REGRESSION>

---

### ✨ New Features
- <feature-name>: <one-line description>
- <feature-name>: <one-line description>

### 🔧 Modified Features
- <feature-name>: <what changed, e.g. "migrated from Obsidian toggle to LibSixtyTen section with independent loop">
- <feature-name>: <what changed>

### ❌ Removed Features
- <feature-name>: <reason if known, e.g. "intentionally deprecated">

### 🛡️ Safety Improvements
- Added pcall wrapping for <N> remote calls
- Added CharacterAdded respawn rebind
- Added circuit breaker for <remote-name> (<N> failure hard disable)
- Fixed unbounded loop in <feature> (added task.wait(<interval>))
- Added StartLoop/StopLoop lifecycle for <feature>

### ⚡ Performance
- Local declaration lines: <before> → <after> (<delta>%)
- Local pressure: <before> → <after>
- Cached <N> frequently-used globals
- Consolidated <N> inline callbacks into <M> taskSpawn loops

### 🎨 UI Changes
- New section: <name> with <N> controls
- Renamed: "<old>" → "<new>"
- Added status paragraph for <feature>
- Migrated <N> controls from <old-framework> to <new-framework>

### 📦 Config
- Config folder: <path>
- Added autoload support
- New setting: <name> (default: <value>)

### 📊 Metrics
- Lines: <before> → <after>
- Risk score: <before> → <after> (<delta>)
- Remote calls: <before> unprotected → <after> protected
- Functions: <before> → <after>

---

### Brain Entries Created
- `<title>` — <summary> (tags: <tags>)
- `<title>` — <summary> (tags: <tags>)

### Delivery Proof
- Migration verdict: <REVIEW/READY> with <N> blockers
- Original checksum: <md5>
- luau-regression-gate: <BLOCKED/CONDITIONAL/READY>
```

## Rules

- Use human-readable feature names throughout
- Safety improvements should be explicit — don't bury them in "misc changes"
- If a feature was MODIFIED, explain the structural change, not just "updated"
- Risk score changes should include the delta direction and magnitude
- Brain entries should be linked by title — not raw JSON references
- If the original was modified, flag it as a VERDIT ISSUE
- Keep each changelog entry to one line — details go in the brain or compare-matrix
- The verdict must match the luau-feature-diff and luau-regression-gate verdicts
