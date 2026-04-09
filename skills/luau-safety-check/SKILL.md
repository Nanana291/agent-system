---
name: luau-safety-check
description: Pre-modification safety checklist for any Luau file. Verifies backups, brain entries, remote safety, UI init, and loop safety before touching code.
---

# Luau Safety Check

Use this skill **before modifying any Luau file**. It is a checklist that must pass before code changes begin.

## Checklist

Run these checks in order. Each check is PASS, WARN, or BLOCK.

### 1. Backup Status

**Check:** Is there a backup or baseline of the target file?

- **PASS:** Baseline snapshot exists (`docs/metrics/snapshots/` or `Feature Baselines/`)
- **WARN:** No snapshot but file is tracked in git (can diff later)
- **BLOCK:** No backup AND file is not tracked — create backup first

**Action on BLOCK:** Run `backup` or capture the file checksum before proceeding.

---

### 2. Brain Query

**Check:** Are there relevant brain entries for this script or game?

Run: `brain search <game-name>` and `brain search <file-basename>`

- **PASS:** Found entries for remotes, known issues, or migration notes
- **WARN:** No game-specific entries but general Luau patterns exist
- **BLOCK:** No entries AND this is a known script with prior issues

**Action on BLOCK:** Query broader patterns (`brain search remote-safety`, `brain search v2-migration`) before proceeding.

---

### 3. Remote Safety Audit

**Check:** Does the file have remote calls?

Search for: `FireServer`, `InvokeServer`, `FireClient`, `InvokeClient`, `FireAllClients`

- **PASS:** All remote calls are wrapped in `pcall` or `pcallRef`
- **WARN:** Some calls are unprotected but the remote is server→client only
- **BLOCK:** Remote calls exist with NO pcall protection

**Action on BLOCK:** Apply the **pcallRef Loop Wrapper** pattern from `luau-pattern-lib` before any modification.

---

### 4. Character Lifecycle

**Check:** Does the script reference `Character`, `HumanoidRootPart`, or `Humanoid`?

- **PASS:** `CharacterAdded` connection exists and loops validate root part
- **WARN:** Character is cached but re-checked in loops
- **BLOCK:** Character/HumanoidRootPart is cached once and never re-validated

**Action on BLOCK:** Apply the **Character Respawn Rebind** pattern from `luau-pattern-lib`.

---

### 5. Loop Safety

**Check:** Does the script have `while true do`, `while task.wait()`, or `repeat` loops?

- **PASS:** All loops use `task.wait()` with a controlled interval and have exit conditions
- **WARN:** Loops use `task.wait()` but interval is very low (<0.1)
- **BLOCK:** Unbounded loops with no `task.wait()` or no exit condition

**Action on BLOCK:** Add `task.wait(interval)` and a kill signal pattern (see **Thread Management** in `luau-pattern-lib`).

---

### 6. UI Framework Init

**Check:** Does the script use LibSixtyTen, Obsidian, or another UI framework?

- **PASS:** Library loads with fallback chain and early-return on failure
- **WARN:** Library loads but no fallback URL chain
- **BLOCK:** UI framework is used but not loaded/initialized in the script

**Action on BLOCK:** Add library loading with fallback before any UI code.

---

### 7. Dashboard Init

**Check:** Does the script use `Dashboard` or `ImpHub` status system?

- **PASS:** Dashboard is initialized before features register themselves
- **WARN:** Dashboard loads after some features (order issue)
- **BLOCK:** Features register before Dashboard exists

**Action on BLOCK:** Move Dashboard init to the top of the feature wiring section.

---

### 8. Local Pressure

**Check:** Does the script have >15 local declaration lines?

- **PASS:** Locals are consolidated (<10 declaration lines)
- **WARN:** 10-15 declaration lines — could consolidate more
- **BLOCK:** >20 declaration lines with no multi-assignment

**Action on BLOCK:** Apply the **Local Consolidation** pattern from `luau-pattern-lib`.

---

## Output

Emit a safety report:

```
[LUAU SAFETY CHECK] <filename>
─────────────────────────────────
Backup:          PASS / WARN / BLOCK
Brain entries:   PASS / WARN / BLOCK
Remote safety:   PASS / WARN / BLOCK
Character life:  PASS / WARN / BLOCK
Loop safety:     PASS / WARN / BLOCK
UI framework:    PASS / WARN / BLOCK / N/A
Dashboard init:  PASS / WARN / BLOCK / N/A
Local pressure:  PASS / WARN / BLOCK

Verdict: SAFE_TO_MODIFY / NEEDS_FIXES / BLOCKED
─────────────────────────────────
Blocked checks: <list or "none">
Required patterns: <list or "none">
```

## Rules

- **All BLOCK checks must be resolved before modifying code.**
- WARN checks should be noted in the delivery gate as open risks.
- If a check is N/A (e.g., no UI in the file), state N/A and move on.
- After resolving a BLOCK, re-run the check to confirm PASS.
- Record the safety check result in the brain if this is a recurring issue.

## Pattern References

When a BLOCK is found, apply the corresponding pattern from `luau-pattern-lib`:

| BLOCK Check | Pattern to Apply |
|-------------|-----------------|
| Remote safety | pcallRef Loop Wrapper (#3) |
| Character lifecycle | Character Respawn Rebind (#2) |
| Loop safety | Thread Management (#7) + pcallRef (#3) |
| UI framework init | LibSixtyTen Section Adapter (#4) |
| Local pressure | Local Consolidation (#5) |
