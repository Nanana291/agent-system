---
description: Summarize data flow in a Luau script: how locals feed functions, how functions feed remote calls, and how UI wiring triggers logic. Produces a flow graph in text form.
---

Analyze the data flow of a Luau script and produce a readable flow summary.

## Input

{{args}}

Accepts:
- A file path: `<script-path>`

## Analysis Layers

### Layer 1: Variable Flow

Track how important locals are defined and consumed:

1. **Configuration locals** — settings, constants, cached globals
2. **State locals** — toggles, flags, enabled/disabled, cooldowns
3. **Reference locals** — Character, HumanoidRootPart, UI elements, remotes
4. **Function locals** — cached function references (pcallRef, taskWait, etc.)

For each variable, find:
- **Where defined** — line of declaration
- **Where read** — lines where it's used as input
- **Where written** — lines where it's modified
- **Where consumed** — final sink (remote call, property write, UI update)

### Layer 2: Function Flow

For each function in the script:

1. **Inputs** — parameters and captured upvalues
2. **Internal flow** — what it computes, what it calls
3. **Outputs** — return values, side effects (remote fire, property set, state change)
4. **Callers** — what calls this function (callback, loop, other function, event handler)

### Layer 3: Remote Flow

For each remote call:

1. **Data source** — where do the arguments come from? (state variable, computed value, UI input)
2. **Trigger path** — what causes the call? (toggle callback, loop tick, event handler)
3. **Rate** — controlled by task.wait interval, event frequency, or user input

### Layer 4: UI Wiring Flow

For each UI element:

1. **Control type** — Toggle, Dropdown, Slider, Button, Textbox
2. **Callback action** — what state does it change? what function does it call?
3. **Reactive elements** — paragraphs/labels that update based on state
4. **Lifecycle** — does the callback start/stop a loop, or fire a one-shot action?

## Output Format

```
[LUAU DATA FLOW] <filename>
─────────────────────────────────────────
Lines: <total> | Functions: <count> | Remotes: <count> | UI Controls: <count>

### State Variables

| Variable | Defined At | Read By | Written By | Sink |
|----------|-----------|---------|------------|------|
| <name>   | line <n>  | <func1>, <func2> | <callback>, <loop> | <remote:X>, <property:Y> |
...

### Function Call Graph

| Function | Inputs | Outputs | Called By | Risk |
|----------|--------|---------|-----------|------|
| <name>   | <params + upvalues> | <return / side-effect> | <caller1>, <caller2> | SAFE / WARN / RISKY |
...

### Remote Call Chains

| Remote | Data Source → Trigger → Call | Rate | pcall |
|--------|----------------------------|------|-------|
| <name> | <state-var> → <loop:0.5s> → FireServer | ~120/min | ✅ |
| <name> | <UI-toggle> → <callback> → FireServer | user-driven | ✅ |
...

### UI Wiring

| Control | Type | Callback Action | State Changed | Lifecycle |
|---------|------|----------------|---------------|-----------|
| "<title>" | Toggle | StartLoop/StopLoop | <flag> = value | STARTS/STOPS loop |
| "<title>" | Dropdown | Updates target var | <target> = value | CONFIG only |
| "<title>" | Paragraph | Reactive text | reads <state> | DISPLAY only |
...

### Flow Risks

| Risk Type | Location | Description |
|-----------|----------|-------------|
| Stale state | <function/loop> | <variable> read but never updated after respawn |
| Unbounded | <loop> | No task.wait or interval too low |
| Blocking | <function> | InvokeServer in loop body |
| Missing guard | <callback> | Action fires without Character check |
| Duplicate fire | <loop> | Remote called multiple times per tick |
...

─────────────────────────────────────────
Flow summary:
  Entry points:    <count> (UI callbacks + event handlers)
  State variables: <count> (<mutable> mutable, <readonly> readonly)
  Remote sinks:    <count> (<pcall-wrapped> protected, <unprotected> unprotected)
  Max chain depth: <n> (UI → function → remote)
─────────────────────────────────────────
```

## Risk Classification

- **SAFE:** All flows have clear entry→state→sink path, pcall-wrapped remotes, Character guards
- **WARN:** Some flows skip state validation or have indirect dependencies
- **RISKY:** Unbounded loops, blocking calls in hot paths, stale references after respawn

## Rules

- Focus on the top 20% of variables that drive 80% of the flow — don't list every local
- Remote call chains are the most important output — always include data source, trigger, and rate
- UI wiring must distinguish between LIFECYCLE controls (start/stop) and CONFIG controls (set value)
- If a function has side effects (remote fire, property write), mark it explicitly
- "Stale state" means a variable that was valid at init but becomes nil after respawn
- Keep the output readable — use text tables, not raw graph notation
