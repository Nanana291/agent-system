---
description: Generate a visual comparison matrix between two Luau script versions (baseline vs modified). Shows feature parity, remote changes, risk deltas, and local pressure.
---

Generate a comparison matrix between an original Luau script and its modified version.

## Input

{{args}}

Accepts one of:
- Two file paths: `<original-path> <modified-path>`
- A single V2 path (auto-locates original by removing V2 suffix)
- A workspace slice: `--target <path> --baseline <path>`

## Output Format

Emit a markdown matrix with these sections:

### Feature Parity

| Feature | Original | Modified | Status |
|---------|----------|----------|--------|
| `<feature-name>` | ✅/❌ | ✅/❌ | PARITY / ADDED / LOST / MODIFIED |

Features to check:
- Auto farm, auto block, auto skills, auto ultimate, auto evasive, auto counter
- Teleport system, ESP, aimbot, fly, noclip, speed, jump power
- Config system, theme system, keybinds, notifications
- Character rebind, respawn handling

### Remote Changes

| Remote | Original Calls | Modified Calls | Delta |
|--------|---------------|----------------|-------|
| `<RemoteName>` | N calls | M calls | +N / -N / UNCHANGED |
| Remote method | FireServer / InvokeServer | FireServer / InvokeServer | SAME / CHANGED |
| pcall wrapper | Yes / No | Yes / No | SAME / ADDED / REMOVED |

### Callback Consolidation

| Pattern | Original | Modified |
|---------|----------|----------|
| Inline callbacks in UI | N | M |
| taskSpawn loops | N | M |
| Direct event handlers | N | M |

Note: Reduction in inline callbacks + increase in taskSpawn loops = intentional consolidation (not a regression).

### Risk Score Delta

| Metric | Original | Modified | Delta |
|--------|----------|----------|-------|
| Local pressure | N | M | +/-N |
| Unprotected remotes | N | M | +/-N |
| Unbounded loops | N | M | +/-N |
| Missing pcall | N | M | +/-N |
| Stale character refs | N | M | +/-N |
| **Total risk score** | N | M | **+/-N** |

### Local Pressure

| Metric | Original | Modified |
|--------|----------|----------|
| Local declaration lines | N | M |
| Cached globals | N | M |
| Multi-assignment groups | N | M |

### Structural Summary

- **Lines:** `<original-lines>` → `<modified-lines>` (+/-N)
- **Functions added:** `<list or "none">`
- **Functions removed:** `<list or "none">`
- **Functions modified:** `<list or "none">`
- **UI framework:** `<Obsidian / LibSixtyTen / Other>` → `<Obsidian / LibSixtyTen / Other>`

### Verdict

State one of:
- **PARITY** — All features present, risk score equal or lower
- **ACCEPTABLE** — All features present, risk score slightly higher (+<5) with justified reason
- **REGRESSION** — Features lost OR risk score significantly higher (+>=5)
- **INCONCLUSIVE** — Cannot determine (e.g., file too different, original missing)

## Rules

- Never mark intentional consolidation (inline→taskSpawn) as a regression
- Always check the original file first — if missing, state INCONCLUSIVE
- Human-readable feature names in the matrix ("Auto Block", not "AutoBlock")
- If a feature is MODIFIED, describe what changed in one line
- Include the original file's md5 checksum if available
- If doing a V2 migration, verify the original is UNTOUCHED (checksum match)
