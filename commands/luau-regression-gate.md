---
description: Block or approve Luau script delivery based on quality thresholds. Checks risk score, remote safety, loop safety, character lifecycle, and feature parity before allowing delivery.
---

Evaluate a Luau script against quality thresholds. Block delivery if any critical check fails.

## Input

{{args}}

Accepts one of:
- A file path: `<script-path>`
- A pair for migration: `<original-path> <modified-path>`
- A directory: checks all `.lua` files

## Check Suite

Run these checks in order. Each is PASS, WARN, or BLOCK.

### 1. Risk Score Threshold

**Check:** What is the total risk score of the modified file?

- **PASS:** Risk score <= 30 (or <= original for migrations)
- **WARN:** Risk score 31-50, or slightly higher than original (+1 to +4)
- **BLOCK:** Risk score > 50, or significantly higher than original (+>=5)

**Threshold rationale:** A script with risk score >50 has too many unresolved patterns to deliver safely.

---

### 2. Remote Safety

**Check:** Are ALL remote calls (FireServer, InvokeServer, FireClient, InvokeClient, FireAllClients) wrapped in pcall/pcallRef?

- **PASS:** 100% of remote calls are pcall-wrapped
- **WARN:** Client→server remotes are protected, but server→client are not (lower risk)
- **BLOCK:** Any client→server remote call is unprotected

**This is the #1 cause of script crashes. Never pass a BLOCK here.**

---

### 3. Loop Safety

**Check:** Do ALL while/repeat loops have task.wait() with interval >= 0.1?

- **PASS:** All loops have task.wait(>=0.1)
- **WARN:** Some loops have task.wait() but interval is <0.1 (0.05-0.09)
- **BLOCK:** Any loop has no task.wait(), or interval <0.05

**Unbounded loops cause script timeouts and disconnects.**

---

### 4. Character Lifecycle

**Check:** If the script references Character/HumanoidRootPart, is there a CharacterAdded connection?

- **PASS:** CharacterAdded connected, loops validate root part
- **WARN:** Character re-checked in loops but no CharacterAdded connection
- **BLOCK:** Character/HumanoidRootPart cached once, no re-validation

**Scripts break on respawn without this check.**

---

### 5. Library Loading

**Check:** If the script uses LibSixtyTen, Obsidian, or other UI framework, is it loaded with failure handling?

- **PASS:** Library loads with fallback chain + early return on failure
- **WARN:** Library loads but no fallback (single URL)
- **BLOCK:** UI framework used but not loaded, or loads without any failure handling

---

### 6. Feature Parity (Migrations Only)

**Check:** For migrations, are all original features present in the modified version?

- **PASS:** 100% feature parity
- **WARN:** All features present but ≥1 is DEGRADED (missing status, no keybind)
- **BLOCK:** ≥1 feature is LOST

---

### 7. Thread Management

**Check:** Do toggles that start loops have StartLoop/StopLoop or equivalent lifecycle control?

- **PASS:** All loops have explicit start/stop with duplicate prevention
- **WARN:** Loops can be stopped but no duplicate prevention
- **BLOCK:** Toggles start loops with no way to stop them

**Duplicate loops accumulate and cause performance degradation.**

---

### 8. Local Pressure

**Check:** Are local declarations reasonably consolidated?

- **PASS:** <10 local declaration lines, multi-assignment used
- **WARN:** 10-15 declaration lines
- **BLOCK:** >20 declaration lines with no consolidation attempt

---

### 9. Original Integrity (Migrations Only)

**Check:** For migrations, is the original file untouched?

- **PASS:** Original checksum matches baseline
- **BLOCK:** Original file was modified

**Never deliver a migration that modified the original.**

---

## Output Format

Emit a regression gate report:

```
[LUAU REGRESSION GATE] <filename>
─────────────────────────────────────────
Risk score:      PASS / WARN / BLOCK  (<score>/100)
Remote safety:   PASS / WARN / BLOCK  (<protected>/<total> remotes)
Loop safety:     PASS / WARN / BLOCK  (<safe>/<total> loops)
Character life:  PASS / WARN / BLOCK / N/A
Library loading: PASS / WARN / BLOCK / N/A
Feature parity:  PASS / WARN / BLOCK / N/A  (<present>/<total>)
Thread mgmt:     PASS / WARN / BLOCK  (<managed>/<total> loops)
Local pressure:  PASS / WARN / BLOCK  (<lines> decl lines)
Orig integrity:  PASS / BLOCK / N/A

─────────────────────────────────────────
BLOCK checks: <list or "none">
WARN checks:  <list or "none">

Verdict: BLOCKED / CONDITIONAL / READY
─────────────────────────────────────────
```

## Verdict

- **BLOCKED:** ≥1 BLOCK check — cannot deliver until resolved
- **CONDITIONAL:** 0 BLOCK, ≥1 WARN — can deliver with documented risks
- **READY:** All PASS (or N/A) — safe to deliver

## Rules

- **BLOCK checks are absolute.** Do not downgrade a BLOCK to a WARN to make the gate pass.
- **WARN checks must be documented.** List them in the delivery gate as open risks.
- **N/A is valid.** If a check doesn't apply (e.g., no Character refs), mark N/A and continue.
- **Migrations have extra checks.** Feature parity and original integrity only apply when comparing two files.
- **Risk score trend matters.** If this is a re-check, compare to the previous score.
- **Record the gate result.** Add a brain entry with the gate verdict and any BLOCK/WARN details.

## Integration

This command complements:
- `/gate` — which checks artifacts and process
- `luau-gate` — which validates repair snapshots
- `qa-inspector` — which reviews routed agent work

Use this for the **code-level** quality check, and `/gate` for the **process-level** check. Both must pass for delivery.
