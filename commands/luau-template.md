---
description: Generate a Luau script scaffold with safety patterns pre-wired. Supports new script, new feature, LibSixtyTen section, and V2 migration templates.
---

Generate a Luau script scaffold with built-in safety patterns.

## Input

{{args}}

Accepts:
- Template type + name: `--type <type> --name <name> --game <game>`
- Types: `new-script`, `new-feature`, `libsixtyten-section`, `v2-migration`, `minimal`

## Templates

### Type: new-script

Full script scaffold with all safety patterns:

```luau
--[[
    <GameName> — Imp Hub X
    Generated: <date>
    Framework: LibSixtyTen
--]]

-- ═══════════════════════════════════════
-- 1. CACHED GLOBALS (multi-assignment)
-- ═══════════════════════════════════════
local t_insert, t_remove, m_huge, m_floor, str_format, str_gsub, str_find =
    table.insert, table.remove, math.huge, math.floor,
    string.format, string.gsub, string.find
local pcallRef, taskWait, taskSpawn, taskDefer =
    pcall, task.wait, task.spawn, task.defer
local tickRef, timeRef = tick, time

-- ═══════════════════════════════════════
-- 2. SERVICES & REFERENCES
-- ═══════════════════════════════════════
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local LocalPlayer = Players.LocalPlayer or Players:GetPropertyChangedSignal("LocalPlayer"):Wait()

-- ═══════════════════════════════════════
-- 3. STATE
-- ═══════════════════════════════════════
local <GameName>Config = {
    Enabled = false,
}

-- ═══════════════════════════════════════
-- 4. CHARACTER LIFECYCLE
-- ═══════════════════════════════════════
local Character = LocalPlayer.Character or LocalPlayer.CharacterAdded:Wait()
LocalPlayer.CharacterAdded:Connect(function(newChar)
    Character = newChar
end)

local function GetRoot()
    return Character and Character:FindFirstChild("HumanoidRootPart")
end

-- ═══════════════════════════════════════
-- 5. REMOTE CACHE
-- ═══════════════════════════════════════
local Remotes = {}

local function CacheRemote(name)
    if Remotes[name] then return Remotes[name] end
    local remote = ReplicatedStorage:FindFirstChild(name)
        or ReplicatedStorage:WaitForChild(name, 10)
    if not remote then
        warn("[Remote] Not found: " .. name)
        return nil
    end
    Remotes[name] = remote
    return remote
end

-- ═══════════════════════════════════════
-- 6. CIRCUIT BREAKER
-- ═══════════════════════════════════════
local REMOTE_FAILURES = 0
local REMOTE_MAX_FAILURES = 6
local remoteDisabled = false

local function SafeRemoteCall(remote, method, ...)
    if remoteDisabled or not remote then return nil end
    local ok, result = pcallRef(method, remote, ...)
    if not ok then
        REMOTE_FAILURES += 1
        if REMOTE_FAILURES >= REMOTE_MAX_FAILURES then
            remoteDisabled = true
            warn("[CircuitBreaker] Disabled after " .. REMOTE_MAX_FAILURES .. " failures")
        end
        return nil
    end
    REMOTE_FAILURES = 0
    return result
end

-- ═══════════════════════════════════════
-- 7. THREAD MANAGEMENT
-- ═══════════════════════════════════════
local activeLoops = {}

local function StopLoop(key)
    if activeLoops[key] then
        activeLoops[key] = nil
    end
end

local function StartLoop(key, interval, action)
    StopLoop(key)
    local loopId = {}
    activeLoops[key] = loopId
    taskSpawn(function()
        while taskWait(interval) do
            if activeLoops[key] ~= loopId then return end
            local Root = GetRoot()
            if not Root then continue end
            local ok, err = pcallRef(action)
            if not ok and err then
                warn("[Loop:" .. key .. "] " .. tostring(err))
            end
        end
    end)
end

-- ═══════════════════════════════════════
-- 8. STATUS BUILDERS
-- ═══════════════════════════════════════
local function BuildBasicStatus(name, enabled)
    return str_format("%s: %s", name, enabled and "✅ On" or "❌ Off")
end

local function BuildDetailedStatus(name, enabled, extra)
    return str_format("%s: %s | %s", name, enabled and "✅" or "❌", extra or "N/A")
end

-- ═══════════════════════════════════════
-- 9. FEATURE FUNCTIONS
-- ═══════════════════════════════════════

local function SetupFeatures()
    -- Define feature logic here
end

-- ═══════════════════════════════════════
-- 10. LIBRARY LOAD
-- ═══════════════════════════════════════
local LIB_URLS = {
    "https://raw.githubusercontent.com/Nanana291/Kong/main/LibSixtyTen.lua",
    "https://raw.githubusercontent.com/Nanana291/Imp-Hub-X/main/lib/LibSixtyTen.lua",
    "https://cdn.jsdelivr.net/gh/Nanana291/Kong@main/LibSixtyTen.lua",
}

local function LoadLibSixtyTen()
    for _, url in ipairs(LIB_URLS) do
        local ok, source = pcallRef(game.HttpGet, game, url)
        if ok and source and source ~= "" then
            local loadOk, factory = pcallRef(loadstring, source)
            if loadOk and factory then return factory() end
        end
    end
    return nil
end

local Lib = LoadLibSixtyTen()
if not Lib then
    warn("[LibSixtyTen] Failed to load — aborting")
    return
end

-- ═══════════════════════════════════════
-- 11. UI SETUP
-- ═══════════════════════════════════════
local Window = Lib:CreateWindow("<GameName>")

-- Main tab
local MainTab = Window:CreateTab("Main")

-- Features section
local FeaturesSection = Lib:BuildSection(MainTab, {
    Type = "Section",
    Title = "Features",
})

FeaturesSection:BuildToggle({
    Title = "Enabled",
    Flag = "<GameName>_Enabled",
    Callback = function(Value)
        <GameName>Config.Enabled = Value
        if Value then
            StartLoop("main", 0.5, function()
                -- Main loop action
            end)
        else
            StopLoop("main")
        end
    end,
})

FeaturesSection:BuildParagraph({
    Title = "Status",
    Text = function()
        return BuildBasicStatus("<GameName>", <GameName>Config.Enabled)
    end,
})

-- Settings tab
local SettingsTab = Window:CreateTab("Settings")

Lib:BuildConfigSection(SettingsTab)
Lib:SetFolder("ImpHub")
Lib:SetFolder("ImpHub/<GameName>")
Lib:LoadAutoloadConfig()

-- ═══════════════════════════════════════
-- 12. INIT
-- ═══════════════════════════════════════
SetupFeatures()
```

### Type: new-feature

Single feature function with loop + toggle wiring:

```luau
-- Feature: <FeatureName>
local <FeatureName>Config = {
    Enabled = false,
    Interval = 0.5,
}

local function <FeatureName>Action()
    local Root = GetRoot()
    if not Root then return end
    -- Feature logic here
end

local function Setup<FeatureName>(section)
    section:BuildToggle({
        Title = "<Human Readable Name>",
        Flag = "<GameName>_<FeatureName>",
        Callback = function(Value)
            <FeatureName>Config.Enabled = Value
            if Value then
                StartLoop("<featureName>", <FeatureName>Config.Interval, <FeatureName>Action)
            else
                StopLoop("<featureName>")
            end
        end,
    })

    section:BuildParagraph({
        Title = "Status",
        Text = function()
            return BuildBasicStatus("<Human Readable Name>", <FeatureName>Config.Enabled)
        end,
    })
end
```

### Type: libsixtyten-section

Single section with controls:

```luau
local <SectionName>Section = Lib:BuildSection(<ParentTab>, {
    Type = "Section",
    Title = "<Human Readable Title>",
    Side = 1, -- 1 = left, 2 = right
})

<SectionName>Section:BuildToggle({
    Title = "<Toggle Title>",
    Flag = "<GameName>_<ToggleFlag>",
    Default = false,
    Callback = function(Value)
        -- Action on toggle change
    end,
})

<SectionName>Section:BuildDropdown({
    Title = "<Dropdown Title>",
    Flag = "<GameName>_<DropdownFlag>",
    Items = { "Option 1", "Option 2", "Option 3" },
    Default = "Option 1",
    Multi = false,
    Callback = function(Value)
        -- Value is string (single) or table (multi)
    end,
})

<SectionName>Section:BuildSlider({
    Title = "<Slider Title>",
    Flag = "<GameName>_<SliderFlag>",
    Default = 50,
    Min = 0,
    Max = 100,
    Rounding = 0,
    Callback = function(Value)
        -- Value is number
    end,
})

<SectionName>Section:BuildParagraph({
    Title = "Status",
    Text = function()
        return "Ready"
    end,
})
```

### Type: v2-migration

Header comment for V2 migration + migration checklist reference:

```luau
--[[
    <GameName> V2 — Imp Hub X
    Migrated: <date>
    From: Obsidian → LibSixtyTen
    Original: <GameName>.lua (checksum: <md5>)
    
    Migration checklist:
    1. Clone original, never modify it
    2. Map Obsidian tabs → LibSixtyTen tabs
    3. Map Obsidian sections → LibSixtyTen sections
    4. Add status paragraphs for each feature
    5. Wire all remotes with pcallRef
    6. Add CharacterAdded respawn rebind
    7. Add circuit breaker for hot remotes
    8. Add StartLoop/StopLoop lifecycle
    9. Consolidate local declarations
    10. Integrate ThemeManager + SaveManager
    
    Study references:
    - PixelBladeV2.lua (adapter pattern)
    - RoguePieceV2.lua (status paragraphs)
    - GardenTowerDefenseV2.lua (circuit breaker)
    - AnimeGhosts.lua (native LibSixtyTen)
--]]
```

### Type: minimal

Bare minimum safe script:

```luau
-- Minimal Luau scaffold
local pcallRef, taskWait = pcall, task.wait

local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer or Players:GetPropertyChangedSignal("LocalPlayer"):Wait()

local Character = LocalPlayer.Character or LocalPlayer.CharacterAdded:Wait()
LocalPlayer.CharacterAdded:Connect(function(newChar)
    Character = newChar
end)

local function GetRoot()
    return Character and Character:FindFirstChild("HumanoidRootPart")
end

-- Add logic here
```

## Rules

- Always use the `new-script` template as the base for new scripts
- Always include circuit breaker for any remote called in a loop
- Always include CharacterAdded connection if Character is referenced
- Always use human-readable names in UI controls
- Always fail closed on library load (early return, not crash)
- The `luau-template` command should output to `--output <path>` if specified, otherwise print to stdout
