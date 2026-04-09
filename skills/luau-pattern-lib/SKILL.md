---
name: luau-pattern-lib
description: Search and apply reusable Luau patterns before writing or modifying code. Prevents re-discovering known solutions.
---

# Luau Pattern Library

Use this skill **before writing or modifying any Luau code** to find and apply proven patterns.

## When to Use

- About to write a new Luau feature
- About to modify an existing Luau script
- Uncertain how to structure a remote, loop, callback, or UI section
- Doing a V2 migration and need the target pattern

## Pattern Catalogue

### 1. Remote Rate Limiter (Circuit Breaker)

**Use when:** A remote is called repeatedly (auto farm, auto skills, teleport).

```luau
-- Pattern: Circuit breaker remote protection
local REMOTE_FAILURES = 0
local REMOTE_MAX_FAILURES = 6
local remoteDisabled = false

local function SafeRemoteCall(remoteMethod, ...)
    if remoteDisabled then return nil end
    local ok, result = pcall(remoteMethod, ...)
    if not ok then
        REMOTE_FAILURES += 1
        if REMOTE_FAILURES >= REMOTE_MAX_FAILURES then
            remoteDisabled = true
            warn("[CircuitBreaker] Remote disabled after " .. REMOTE_MAX_FAILURES .. " failures")
        end
        return nil
    end
    REMOTE_FAILURES = 0
    return result
end
```

**Rules:**
- Hard disable after 6 consecutive failures
- Never auto-re-enable — require explicit restart or manual reset
- Log the disable reason for debugging

---

### 2. Character Respawn Rebind

**Use when:** Script stores Character, HumanoidRootPart, or Humanoid references that break on death.

```luau
-- Pattern: Character rebind via CharacterAdded
local Character = LocalPlayer.Character or LocalPlayer.CharacterAdded:Wait()
LocalPlayer.CharacterAdded:Connect(function(newChar)
    Character = newChar
end)

-- Inside every loop, validate before use:
local Root = Character:FindFirstChild("HumanoidRootPart")
if not Root then task.wait() continue end
```

**Rules:**
- Always connect `CharacterAdded` at script start
- Every long-lived loop MUST validate `HumanoidRootPart` existence
- Never cache `HumanoidRootPart` in a variable without re-checking

---

### 3. pcallRef Loop Wrapper

**Use when:** A `taskSpawn` loop fires remotes, yields, or does unsafe operations.

```luau
-- Pattern: pcallRef-cached loop
local pcallRef = pcall

taskSpawn(function()
    while task.wait(interval) do
        local Root = Character and Character:FindFirstChild("HumanoidRootPart")
        if not Root then continue end

        local ok, err = pcallRef(function()
            -- action code here (remote calls, math, property writes)
        end)
        if not ok and err then
            warn("[Loop] Error: " .. tostring(err))
        end
    end
end)
```

**Rules:**
- Cache `pcall` as `pcallRef` at the top of the file
- Wrap ALL action code inside the loop in `pcallRef`
- Log errors but don't crash the loop
- Validate Character/RootPart before entering the action

---

### 4. LibSixtyTen Section Adapter

**Use when:** Migrating from Obsidian toggles to LibSixtyTen UI sections.

```luau
-- Pattern: LibSixtyTen section with toggle + paragraph
local Section = Lib:BuildSection(LibWindow, {
    Type = "Section",
    Title = "Auto Farm",
})

Section:BuildToggle({
    Title = "Enabled",
    Callback = function(Value)
        AutoFarmEnabled = Value
        -- Start/stop loop lifecycle here, NOT inline action
    end,
})

Section:BuildParagraph({
    Title = "Status",
    Text = function()
        return AutoFarmEnabled and "Running" or "Stopped"
    end,
})
```

**Rules:**
- Master toggle controls lifecycle (start/stop loop)
- Child controls (orbit, mode, offsets) go in the same section
- Status paragraph uses a function (reactive, not static text)
- Mobile-first: no hover dependency in callbacks

---

### 5. Local Consolidation

**Use when:** A script has >10 `local` declarations that could be merged.

```luau
-- Before (high pressure):
local t_insert = table.insert
local m_huge = math.huge
local str_fmt = string.format
local pcallRef = pcall
local taskWait = task.wait

-- After (consolidated):
local t_insert, m_huge, str_fmt, pcallRef, taskWait =
    table.insert, math.huge, string.format, pcall, task.wait
```

**Rules:**
- Group by semantic affinity (table funcs, math funcs, etc.)
- Never split a multi-assignment across lines if it fits
- Cache frequently used globals at the top of the file
- Target: reduce local declaration lines by 50%+

---

### 6. Imp Hub Status Builder

**Use when:** A feature needs visible status feedback.

```luau
-- Pattern: BuildBasicStatus for simple toggles
local function BuildBasicStatus(featureName, enabled)
    return string.format("%s: %s", featureName, enabled and "✅ On" or "❌ Off")
end

-- Pattern: BuildDetailedStatus for complex features
local function BuildDetailedStatus(featureName, enabled, extra)
    return string.format("%s: %s | %s",
        featureName,
        enabled and "✅" or "❌",
        extra or "N/A"
    )
end
```

**Rules:**
- Use human-readable feature names ("Auto Block", not "AutoBlock")
- Include checkmark/cross emoji for visual state
- Extra info: counts, positions, cooldowns, targets
- Status text must match the section title wording

---

### 7. Thread Management (StartLoop/StopLoop)

**Use when:** A toggle needs to start and stop a background loop cleanly.

```luau
-- Pattern: StartLoop / StopLoop
local activeLoop = nil

local function StopLoop()
    if activeLoop then
        activeLoop = nil  -- signal loop to exit
    end
end

local function StartLoop()
    StopLoop()  -- prevent duplicates
    activeLoop = {}
    taskSpawn(function()
        local loopId = activeLoop
        while task.wait(0.5) do
            if activeLoop ~= loopId then return end  -- stale loop
            -- action
        end
    end)
end
```

**Rules:**
- Always stop existing loop before starting new one
- Use identity check (`loopId`) to kill stale loops
- Never use `coroutine.yield` for loop control
- `activeLoop = nil` is the kill signal

---

## How to Apply

1. **Brain query first:** `brain search <pattern-name>` for workspace-specific variants
2. **Identify pattern:** Match the task to one or more patterns above
3. **Adapt, don't invent:** Use the pattern as the base, adapt variable names to context
4. **Verify:** Check the pattern's rules are all satisfied in the final code
5. **Record:** If a variant proves useful, `brain add` it with the pattern tag

## Pattern Tags

When recording or searching, use these tags:
- `remote-safety` — patterns 1, 3
- `character-lifecycle` — pattern 2
- `ui-wiring` — patterns 4, 6
- `local-pressure` — pattern 5
- `thread-management` — pattern 7
- `v2-migration` — patterns 4, 5, 6
- `circuit-breaker` — pattern 1
- `pcall-pattern` — pattern 3

## Rules

- Always search this catalogue BEFORE inventing a new approach
- If a pattern doesn't fit, explain why before deviating
- Patterns are starting points — adapt to context, don't copy verbatim
- Record useful variants in the brain with the source file path
