---
name: brain-auto-tag
description: Automatically suggest and apply consistent tags to brain entries based on content analysis. Ensures searchable, well-organized brain data.
---

# Brain Auto-Tag

Use this skill when adding a new brain entry or auditing existing entries. It suggests tags based on content patterns, not manual guesswork.

## Tag Taxonomy

### Source Tags (where it came from)

| Tag | Trigger |
|-----|---------|
| `audit` | Entry derived from scanning/auditing a file |
| `migration` | Entry from a V1→V2 or framework migration |
| `repair` | Entry from fixing a specific bug or risk |
| `incident` | Entry from a runtime failure or crash |
| `learned` | General lesson learned during work |

### Pattern Tags (what it's about)

| Tag | Trigger Keywords in Content |
|-----|---------------------------|
| `remote-safety` | pcall, FireServer, InvokeServer, remote, rate limit, circuit breaker |
| `pcall-pattern` | pcall, pcallRef, error handling, try-catch equivalent |
| `character-lifecycle` | CharacterAdded, respawn, HumanoidRootPart, Character nil, death |
| `thread-management` | taskSpawn, loop, StartLoop, StopLoop, thread, coroutine, kill signal |
| `local-pressure` | local declarations, consolidate, multi-assignment, cached global |
| `ui-wiring` | LibSixtyTen, Obsidian, section, toggle, paragraph, tab, dashboard |
| `v2-migration` | V2, migration, clone, rename, LibSixtyTen, Obsidian, parity |
| `circuit-breaker` | failure count, disable after, hard disable, remote failures |
| `config-pattern` | SaveManager, ThemeManager, config folder, autoload, settings |
| `status-pattern` | imp-hub-status, BuildBasicStatus, BuildDetailedStatus, status paragraph |
| `taint-signal` | webhook, token, leak, exfiltration, backdoor, obfuscated |
| `performance` | loop pressure, register pressure, unbounded, GC, yield |

### Domain Tags (which area)

| Tag | Trigger |
|-----|---------|
| `logic` | Entry about game logic, calculations, state |
| `ui` | Entry about UI layout, wiring, controls |
| `compat` | Entry about executor compatibility, library loading |
| `lifecycle` | Entry about character respawn, script init, cleanup |
| `optimization` | Entry about performance, local pressure, caching |
| `security` | Entry about leaks, tokens, backdoors, validation |

### Severity Tags (how critical)

| Tag | Trigger |
|-----|---------|
| `critical` | Script crash, data loss, security vulnerability |
| `important` | Feature broken, noticeable degradation |
| `minor` | Style issue, could be better, informational |

### Game Tags (which game)

Extract game name from:
- File basename: `StrongestBattlegrounds.lua` → `strongest-battlegrounds`
- Path segment: `/StrongestBattlegroundsV2.lua` → `strongest-battlegrounds`
- Brain entry scope or title mentioning a game

Format: lowercase, hyphenated, no spaces.

## Tagging Workflow

### When Adding a New Entry

1. **Analyze the content** for trigger keywords from the pattern table
2. **Determine the source** (audit/migration/repair/incident/learned)
3. **Identify the domain** (logic/ui/compat/lifecycle/optimization/security)
4. **Assign severity** based on impact described
5. **Add game tag** if the entry is game-specific
6. **Suggest tags** before calling `brain add`

### Example

Content: "Remote FireServer on AutoFarm not wrapped in pcall. Loop fires every 0.1s without task.wait. Causes disconnect after 30 seconds."

Suggested tags:
- `remote-safety` (FireServer mention)
- `pcall-pattern` (missing pcall)
- `thread-management` (loop without task.wait)
- `circuit-breaker` (disconnect after repeated calls)
- `critical` (causes disconnect)
- `strongest-battlegrounds` (if game-specific)

### When Auditing Existing Entries

1. List all entries: `brain list`
2. For each entry, check if tags match the content using the trigger table
3. **Suggest additions:** Missing tags that should apply based on content
4. **Suggest removals:** Tags present but content doesn't match triggers
5. **Suggest consolidations:** Entries with nearly identical tag sets that might be duplicates

## Output

When suggesting tags:

```
[BRAIN AUTO-TAG] "<entry-title>"
─────────────────────────────────
Source tags:     <tag>, <tag>
Pattern tags:    <tag>, <tag>, <tag>
Domain tags:     <tag>
Severity tags:   <tag>
Game tags:       <tag> (if applicable)

Suggested: <tag1>, <tag2>, <tag3>, ...
Existing:  <tag1>, <tag2>
Add:       <new-tag1>, <new-tag2>
Remove:    <stale-tag> (reason: <why>)
─────────────────────────────────
```

## Rules

- **Consistency over creativity.** Use the exact tag names from the taxonomy, not variants.
- **Multiple tags are normal.** An entry about a pcall-wrapped remote in a V2 migration gets at least 4 tags.
- **Game tags are lowercase-hyphenated.** `strongest-battlegrounds`, not `StrongestBattlegrounds`.
- **Don't tag the obvious.** Every Luau entry gets `remote-safety` — only add it if the content specifically mentions remote patterns.
- **Prefer more tags over fewer.** It's easier to filter by multiple tags than to search for untagged entries.
- **When in doubt, check existing entries.** Search `brain search <pattern-tag>` to see how others use it.

## Integration

Use this skill automatically:
- Before `brain add`: run auto-tag to suggest tags
- After `brain add`: verify the tags match the taxonomy
- Periodically: audit all entries for tag drift
