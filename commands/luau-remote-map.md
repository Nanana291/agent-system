---
description: Map all remote calls in a Luau script: names, arguments, pcall status, fire method, frequency, and handler coverage. Reports missing handlers and unsafe remote patterns.
---

Map all remote events and functions in a Luau script with full coverage analysis.

## Input

{{args}}

Accepts:
- A file path: `<script-path>`
- A directory: scans all `.lua` files and aggregates

## Detection

### Remote Sources

Search for:
1. `RemoteEvent:FireServer(...)` — client→server event
2. `RemoteFunction:InvokeServer(...)` — client→server function
3. `RemoteEvent:FireClient(...)` / `FireAllClients(...)` — server→client event
4. `RemoteFunction:InvokeClient(...)` — server→client function
5. `RemoteEvent.OnServerEvent:Connect(...)` — server handler
6. `RemoteEvent.OnClientEvent:Connect(...)` — client handler
7. `RemoteFunction.OnServerInvoke:Connect(...)` — server function handler
8. `RemoteFunction.OnClientInvoke:Connect(...)` — client function handler
9. `game:GetService("ReplicatedStorage")...` — remote acquisition
10. `Remote:FireServer` via variable: `<var>:FireServer(...)`

### For Each Remote Call, Extract

- **Remote name/path** — the variable or path to the remote
- **Fire method** — FireServer, InvokeServer, FireClient, FireAllClients, InvokeClient
- **Arguments** — count and types (string literal, number, variable, nil, table, boolean)
- **pcall wrapped** — yes/no, and if yes, is it pcallRef (cached) or raw pcall
- **Call site line** — line number in the source
- **Call frequency** — how many times this remote is called
- **Call context** — inside loop, inside callback, inside function, or top-level

### Handler Mapping

For each remote that is FIRED, check if a corresponding HANDLER exists:
- `Remote:FireServer` → look for `Remote.OnServerEvent:Connect`
- `Remote:InvokeServer` → look for `Remote.OnServerInvoke:Connect`
- `Remote:FireClient` → look for `Remote.OnClientEvent:Connect`
- `Remote:InvokeClient` → look for `Remote.OnClientInvoke:Connect`

Mark as:
- **COVERED** — handler exists
- **MISSING** — no handler found (likely calls server script)
- **AMBIGUOUS** — handler may exist in another file

## Output Format

```
[LUAU REMOTE MAP] <filename>
─────────────────────────────────────────
Total remotes:     <count>
Unique remotes:    <count>
Fire calls:        <count>
Handler connects:  <count>
Pcall-wrapped:     <count>/<total> (<percentage>%)

─────────────────────────────────────────
### Remote Directory

| # | Remote Name | Method | Args | pcall | Line | Context |
|---|-------------|--------|------|-------|------|---------|
| 1 | <name>      | <method> | <n> args (<types>) | ✅/❌ | <line> | <loop/callback/func/top> |
...

### Handler Coverage

| Remote | Fired As | Handler | Status |
|--------|----------|---------|--------|
| <name> | FireServer | OnServerEvent:Connect | COVERED / MISSING / AMBIGUOUS |
| <name> | InvokeServer | OnServerInvoke:Connect | COVERED / MISSING / AMBIGUOUS |
...

### Unsafe Remotes (BLOCK)

| Remote | Issue | Line |
|--------|-------|------|
| <name> | Not pcall-wrapped | <line> |
| <name> | FireServer in tight loop (no task.wait) | <line> |
| <name> | InvokeServer (blocking) in loop | <line> |
...

### Remote Frequency

| Remote | Call Count | Context |
|--------|-----------|---------|
| <name> | <count> | <loop: <interval>s / callback / function> |
...

### Argument Analysis

Remotes with string-literal actions:
| Remote | Action Strings |
|--------|---------------|
| <name> | "AutoFarm", "Teleport", "Attack" |

Remotes with table arguments:
| Remote | Table Keys (if inferable) |
|--------|--------------------------|
| <name> | .Target, .Position, .Type |

─────────────────────────────────────────
Summary:
  Covered handlers:    <n>/<total>
  Missing handlers:    <n> (expected — server-side)
  Unsafe (no pcall):   <n>
  Blocking (Invoke in loop): <n>
  High-frequency:      <n> (>10 calls/min estimated)

Verdict: SAFE / WARN / RISKY
─────────────────────────────────────────
```

## Verdict Rules

- **SAFE:** 100% pcall-wrapped, no InvokeServer in loops, no tight-loop FireServer
- **WARN:** Some remotes unprotected but not in hot paths, or InvokeServer outside loops
- **RISKY:** Any FireServer/InvokeServer without pcall in a loop, or >5 unprotected remotes total

## Rules

- Distinguish between client-sided remotes (FireServer) and server-sided remotes (FireClient)
- A MISSING handler for FireServer is normal — the server handles it in a different script
- A MISSING handler for OnClientEvent when the script fires it IS a problem
- String-literal arguments reveal the remote's API — extract and list them
- If a remote is acquired via `game:GetService("ReplicatedStorage"):WaitForChild("<name>")`, note the path
- Count InvokeServer in loops as a performance risk (blocking call)
- FireServer in loops without task.wait is a rate-limit risk
