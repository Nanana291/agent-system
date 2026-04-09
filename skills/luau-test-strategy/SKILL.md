---
name: luau-test-strategy
description: Define how to verify Luau scripts without executing them — source-level checks, invariant assertions, pattern validation, and structural tests.
---

# Luau Test Strategy

Use this skill when you need to verify a Luau script's correctness without a Roblox runtime.

## Principle

You cannot execute Luau outside Roblox. But you CAN verify structure, patterns, and invariants from the source. This skill defines what to check.

## Test Categories

### 1. Structural Tests (always run)

These check that the script has the right shape:

| Test | What to Check | Pass Condition |
|------|--------------|----------------|
| File parses | No syntax errors, balanced `end`, matching `then` | Zero parse errors |
| Library loads | LibSixtyTen/Obsidian loading with fallback | Has pcall + fallback URL |
| Entry point exists | Script has a clear "main" section after setup | Dashboard or UI build after locals |
| Balanced blocks | `function/end`, `if/end`, `for/end`, `while/end` match | Equal open/close counts |
| No orphan code | Code after early `return` or `break` that's unreachable | No dead code sections |

### 2. Safety Invariants (must pass)

These check that critical safety patterns exist:

| Test | What to Check | Pass Condition |
|------|--------------|----------------|
| Remote protection | Every `FireServer`/`InvokeServer` inside `pcall()` | 100% covered |
| Character rebind | `CharacterAdded:Connect(...)` exists if Character is referenced | Present |
| Loop intervals | Every `while` has `task.wait(n)` with n >= 0.1 | All loops protected |
| Nil guards | `if not Character then` or `:FindFirstChild` before use | Present in loops |
| No `while true do` | All infinite loops have a kill signal or `task.wait` | Kill signal present |
| No raw `getgenv()` | Sensitive globals not used without validation | Validated or absent |

### 3. Pattern Tests (should pass)

These check that known-good patterns are used:

| Test | What to Check | Ideal |
|------|--------------|-------|
| pcallRef caching | `local pcallRef = pcall` at top | Present |
| Local consolidation | Multi-assignment for cached globals | <10 decl lines |
| StartLoop/StopLoop | Toggle lifecycle management | Present for loop features |
| Status paragraphs | BuildBasicStatus or BuildDetailedStatus | Per feature |
| Thread identity check | `local loopId = activeLoop` + `if activeLoop ~= loopId then return` | Present |
| Circuit breaker | Failure counter with hard disable | Present for hot remotes |

### 4. Feature Parity Tests (migrations only)

These check that a V2 matches the original:

| Test | What to Check | Pass |
|------|--------------|------|
| Feature count | Same number of features (sections/toggles) | Original count = V2 count |
| Remote coverage | Same remotes called (may be restructured) | All original remotes present |
| Keybind preservation | Same keybinds registered | Original keybinds = V2 keybinds |
| Config compatibility | Config system present | SaveManager or equivalent |
| Original untouched | Original file checksum unchanged | md5sum match |

### 5. UI Wiring Tests (UI scripts only)

These check that the UI is correctly wired:

| Test | What to Check | Pass |
|------|--------------|------|
| Toggle → state | Each toggle sets a state variable | No orphan toggles |
| State → loop | Each state variable controls a loop or action | No disconnected state |
| Paragraph → state | Each status paragraph reads state | Reactive (function), not static |
| Master → children | Master toggle gates child controls | Child controls inside master's section |
| No hover dependency | Callbacks don't rely on hover state | Mobile-compatible |

## Test Execution Workflow

### Step 1: Quick Scan

Run these grep searches to get counts:
- `FireServer` / `InvokeServer` → remote count
- `pcall` / `pcallRef` → protection count
- `while` → loop count
- `task.wait` → interval count
- `CharacterAdded` → respawn handling
- `BuildToggle` / `BuildSection` → UI control count

### Step 2: Spot Check

For each remote call: verify it's inside a pcall block.
For each loop: verify it has task.wait and a nil guard.
For each callback: verify it doesn't inline the action (should call a function or toggle state).

### Step 3: Flow Verification

Trace one complete path: UI toggle → state change → loop start → remote fire → status update.
If one path works, the pattern is likely correct for others.

### Step 4: Risk Scan

Check for:
- `while true do` without task.wait
- `InvokeServer` inside a loop
- Remote calls without pcall
- Character/HumanoidRootPart cached without re-check
- `getgenv()` or `loadstring()` with user input

## Output Format

```
[LUAU TEST REPORT] <filename>
─────────────────────────────────────────
Structural tests:   <passed>/<total>
Safety invariants:  <passed>/<total>
Pattern tests:      <passed>/<total>
Feature parity:     <passed>/<total> (or N/A)
UI wiring tests:    <passed>/<total> (or N/A)

Failed tests:
  ❌ <test-name> — <what failed, line reference>
  ❌ <test-name> — <what failed, line reference>

Skipped tests:
  ⏭️ <test-name> — <reason>

Verdict: PASS / WARN / FAIL
─────────────────────────────────────────
```

## Verdict Rules

- **PASS:** All safety invariants pass, ≥80% structural + pattern tests pass
- **WARN:** All safety invariants pass, but <80% pattern tests pass (style gaps, not safety)
- **FAIL:** Any safety invariant fails — must fix before delivery

## Rules

- Safety invariants are non-negotiable — they are the minimum for a runnable script
- Pattern tests are quality indicators — failing them doesn't break the script, but makes it worse
- Feature parity only applies to migrations — skip for new scripts
- UI wiring tests only apply to scripts with UI — skip for headless scripts
- Always report what was SKIPPED and why — don't silently ignore categories
