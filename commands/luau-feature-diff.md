---
description: Detect features present in an original Luau script that are missing or degraded in a modified version. Reports lost features, degraded features, and new additions.
---

Detect features present in an original Luau script that are missing or degraded in a modified version.

## Input

{{args}}

Accepts one of:
- Two file paths: `<original-path> <modified-path>`
- A single V2 path (auto-locates original by removing V2 suffix)
- A directory: scans all `.lua` files for V2 pairs

## Detection Method

### Feature Sources

Detect features from these signals:
1. **Section titles** — `Title = "Auto Farm"`, `Text = "Auto Block"`
2. **Toggle names** — variable names in `BuildToggle`, `CreateToggle`
3. **Remote call targets** — `Remote:FireServer("AutoFarm")` → feature name from argument
4. **Loop bodies** — `taskSpawn` functions with recognizable action patterns
5. **Keybind registrations** — keybind names that map to features
6. **Config entries** — saved config keys that reveal feature names
7. **Notification strings** — human-readable names in notify calls

### Feature Categories

Check for these common categories:

| Category | Indicators |
|----------|-----------|
| Auto Farm | Loop that iterates entities, fires farm remote, or moves character |
| Auto Block | Remote fire on attack event, or timed block loop |
| Auto Skills | Remote fire with skill args, or skill selection loop |
| Auto Ultimate | Ultimate remote with cooldown tracking |
| Auto Evasive | Dodge/evasive remote, movement on threat detection |
| Auto Counter | Counter remote triggered by opponent action |
| Auto Parry | Parry remote, timing-based block |
| ESP | WorldToScreen, BillboardGui creation, box/tracer rendering |
| Teleport | CFrame set, teleport remote with position args |
| Fly | Velocity/BodyVelocity manipulation, fly toggle |
| Noclip | CanCollide = false loop, transparency manipulation |
| Speed | WalkSpeed modification |
| Jump Power | JumpPower/JumpHeight modification |
| Aimbot | Mouse/target locking, CFrame lookAt |
| Config System | SaveManager, LoadManager, config folder |
| Theme System | ThemeManager, color customization |
| Keybinds | Keybind registration with feature names |
| Notifications | Notify calls with feature state changes |

### Degradation Detection

A feature is **DEGRADED** (not lost) when:
- Present but status paragraph is missing or shows wrong info
- Present but keybind is not registered
- Present but remote call is unprotected (pcall missing)
- Present but loop has no task.wait() (performance regression)
- Present but toggle doesn't control lifecycle (inline action instead of StartLoop/StopLoop)
- Present but child controls are detached from master toggle

## Output Format

Emit a feature diff report:

```
[LUAU FEATURE DIFF]
─────────────────────────────────────────
Original:  <path> (<features-found> features)
Modified:  <path> (<features-found> features)
─────────────────────────────────────────

LOST Features (<count>):
  ❌ <feature-name> — <how detected in original, e.g. "section title + remote call">
  ❌ <feature-name> — <reason likely lost, e.g. "no matching section in V2">

DEGRADED Features (<count>):
  ⚠️ <feature-name> — <what degraded, e.g. "status paragraph missing">
  ⚠️ <feature-name> — <what degraded, e.g. "remote not pcall-wrapped">

ADDED Features (<count>):
  ✨ <feature-name> — <how detected, e.g. "new section in V2">
  ✨ <feature-name> — <source>

MODIFIED Features (<count>):
  🔧 <feature-name> — <what changed, e.g. "obsidian toggle → libsixtyten section + loop">

UNCHANGED Features (<count>):
  ✅ <feature-name>

─────────────────────────────────────────
Summary: <lost> lost, <degraded> degraded, <added> added, <modified> modified
Verdict: PARITY / ACCEPTABLE / REGRESSION
─────────────────────────────────────────
```

## Verdict Rules

- **PARITY:** 0 lost, 0 degraded
- **ACCEPTABLE:** 0 lost, ≤2 degraded with known/justified reason (e.g., intentional consolidation)
- **REGRESSION:** ≥1 lost OR >2 degraded

## Rules

- Use human-readable feature names in the output
- If a feature name differs between versions (e.g., "AutoBlock" → "Auto Block"), treat as SAME feature if the functionality matches
- If the original file is missing, state INCONCLUSIVE and list what was found in the modified version
- Always check BOTH the UI wiring AND the underlying logic (a section with no action = lost feature)
- Keybind-only features (no UI section) still count as features
- Intentional structural changes (inline callback → taskSpawn loop) are MODIFIED, not DEGRADED
