---
name: luau-executor-compat
description: Check and enforce cross-executor compatibility for Luau scripts. Detects executor-specific APIs, suggests fallbacks, and generates compatibility reports.
---

# Luau Executor Compatibility

Use this skill when a Luau script needs to run across multiple executors (ScriptWare, Fluxus, Delta, Codex, Hydrogen, etc.).

## Executor API Matrix

### Core APIs

| API | ScriptWare | Fluxus | Delta | Codex | Hydrogen | Fallback |
|-----|-----------|--------|-------|-------|----------|----------|
| `loadstring` | ✅ | ✅ | ✅ | ✅ | ✅ | None needed |
| `loadstring` (with custom env) | ✅ | ❌ | ❌ | ❌ | ❌ | `loadstring(code)` only |
| `request` (syn.request) | ✅ (syn) | ✅ | ✅ | ✅ | ❌ | `game:HttpGet` for GET, detect for POST |
| `syn.request` | ✅ | ❌ | ❌ | ❌ | ❌ | Check `request` or `http.request` |
| `http.request` | ❌ | ✅ | ✅ | ❌ | ❌ | Fall back to `request` or `game:HttpGet` |
| `game:HttpGet` | ✅ | ✅ | ✅ | ✅ | ✅ | Universal |
| `game:HttpGetAsync` | ✅ | ✅ | ✅ | ✅ | ✅ | Universal |
| `writefile` | ✅ | ✅ | ✅ | ✅ | ✅ | None needed |
| `readfile` | ✅ | ✅ | ✅ | ✅ | ✅ | None needed |
| `isfile` | ✅ | ✅ | ✅ | ✅ | ✅ | None needed |
| `listfiles` | ✅ | ✅ | ✅ | ✅ | ❌ | Check or stub |
| `makefolder` | ✅ | ✅ | ✅ | ✅ | ✅ | None needed |
| `isfolder` | ✅ | ✅ | ✅ | ✅ | ✅ | None needed |
| `delfolder` | ✅ | ✅ | ✅ | ✅ | ✅ | None needed |
| `delfile` | ✅ | ✅ | ✅ | ✅ | ✅ | None needed |
| `setclipboard` | ✅ | ✅ | ✅ | ✅ | ❌ | Check or stub |
| `toclipboard` | ❌ | ✅ | ✅ | ❌ | ❌ | Alias for setclipboard |
| `getgenv` | ✅ | ✅ | ✅ | ✅ | ✅ | None needed |
| `getrenv` | ✅ | ✅ | ✅ | ❌ | ❌ | Check or stub |
| `hookfunction` | ✅ | ✅ | ❌ | ❌ | ❌ | Check — not universal |
| `newcclosure` | ✅ | ✅ | ✅ | ❌ | ❌ | Check or stub |
| `setfflag` | ❌ | ✅ | ❌ | ❌ | ❌ | Check — rarely needed |
| `identifyexecutor` | ✅ | ✅ | ✅ | ✅ | ✅ | Returns (name, version) |
| ` Drawing` library | ✅ | ✅ | ✅ | ❌ | ❌ | Check — ESP only |
| `gethui` | ✅ | ✅ | ✅ | ❌ | ❌ | Check — for hidden UI |
| `sethiddenproperty` | ✅ | ✅ | ❌ | ❌ | ❌ | Check — rarely needed |
| `firesignal` | ✅ | ✅ | ❌ | ❌ | ❌ | Check — unsafe |
| `fireclickdetector` | ✅ | ✅ | ✅ | ✅ | ❌ | Check |
| `fireproximityprompt` | ✅ | ✅ | ✅ | ✅ | ❌ | Check |

### Library URL Fallback Chain

```luau
local LIB_URLS = {
    "https://raw.githubusercontent.com/Nanana291/Kong/main/LibSixtyTen.lua",
    "https://raw.githubusercontent.com/Nanana291/Imp-Hub-X/main/lib/LibSixtyTen.lua",
    "https://cdn.jsdelivr.net/gh/Nanana291/Kong@main/LibSixtyTen.lua",
}

local function LoadLibSixtyTen()
    for _, url in ipairs(LIB_URLS) do
        local ok, result = pcall(function()
            return game:HttpGet(url)
        end)
        if ok and result and result ~= "" then
            local loadOk, lib = pcall(loadstring, result)
            if loadOk and lib then return lib() end
        end
    end
    return nil
end
```

### Request Method Detection

```luau
-- Detect available request method
local requestFunc = syn and syn.request
    or (http and http.request)
    or request
    or nil

local function SafeRequest(options)
    if requestFunc then
        return requestFunc(options)
    end
    -- Fallback: GET only via game:HttpGet
    if options.Method == "GET" or not options.Method then
        return { Body = game:HttpGet(options.Url), Success = true }
    end
    warn("[Compat] No request method available for " .. (options.Method or "GET"))
    return nil
end
```

## Compatibility Checklist

Check these before marking a script as cross-executor compatible:

### 1. Library Loading
- [ ] Uses fallback URL chain (≥3 URLs)
- [ ] pcall-wrapped loadstring
- [ ] Early return on failure (fail closed)

### 2. File System
- [ ] `isfile`/`isfolder` checks before read/write
- [ ] `makefolder` before writefile
- [ ] Graceful degradation if file API unavailable

### 3. HTTP Requests
- [ ] Detects available request method (syn.request → http.request → request)
- [ ] Fallback to game:HttpGet for GET-only operations
- [ ] Warns (not crashes) when no request method available

### 4. Executor Detection
- [ ] Uses `identifyexecutor()` for conditional logic, not blocking
- [ ] Doesn't hard-require a specific executor
- [ ] Graceful degradation for missing APIs

### 5. Drawing/ESP
- [ ] Checks `Drawing` availability before creating drawings
- [ ] ESP feature disables gracefully if Drawing unavailable
- [ ] No hard crash if ESP is the only feature

### 6. Unsafe APIs
- [ ] `hookfunction` — only used if available, not required
- [ ] `getrenv` — checked before use, stubbed if missing
- [ ] `setfflag` — avoided or checked
- [ ] `firesignal` — avoided (anti-cheat risk)

### 7. Clipboard
- [ ] `setclipboard` or `toclipboard` — detects which is available
- [ ] Not required for core functionality

## Output Format

```
[EXECUTOR COMPAT REPORT] <filename>
─────────────────────────────────────────
APIs used:          <list>
Universal APIs:     <count>/<total> (<percentage>%)
Conditional APIs:   <count> (checked before use)
Hard requirements:  <count> (will break on some executors)
Missing fallbacks:  <count>

### API Usage

| API | Used? | Checked? | Fallback | Safe? |
|-----|-------|----------|----------|-------|
| loadstring | ✅ | N/A | N/A | ✅ |
| request | ✅ | ✅ | game:HttpGet (GET) | ✅ |
| writefile | ✅ | ✅ | isfile check first | ✅ |
| hookfunction | ❌ | N/A | N/A | ✅ |
| Drawing | ✅ | ❌ | None | ⚠️ |
...

### Compatibility Score

| Executor | Compatibility | Missing |
|----------|--------------|---------|
| ScriptWare | ✅ Full | — |
| Fluxus | ✅ Full | — |
| Delta | ⚠️ Partial | Drawing unavailable |
| Codex | ⚠️ Partial | Drawing, setclipboard |
| Hydrogen | ⚠️ Partial | request, Drawing |

─────────────────────────────────────────
Verdict: FULL / PARTIAL / BROKEN
─────────────────────────────────────────
```

## Verdict Rules

- **FULL:** Works on all major executors with graceful degradation
- **PARTIAL:** Works on most executors but has features that disable on some (e.g., ESP without Drawing)
- **BROKEN:** Hard-requires an API not available on major executors (will crash)

## Rules

- Universal APIs (game:HttpGet, loadstring, writefile, etc.) should be used by default
- Non-universal APIs must be detected and conditionally used
- Never crash if an optional API is missing — degrade gracefully
- Library loading MUST have a fallback chain (≥3 URLs)
- Request method detection MUST support syn.request, http.request, and request
- ESP/Drawing features should create-once and check availability, not hard-require
- Report which executors have FULL compatibility and which have limitations
