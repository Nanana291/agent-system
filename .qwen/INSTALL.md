# Installing Agent System for Qwen Code

Install the repository as a native Qwen extension. Qwen will load `QWEN.md`, `commands/`, `skills/`, and `agents/` from the extension.

## Installation

```bash
qwen extensions install https://github.com/Nanana291/agent-system
```

Short form:

```bash
qwen extensions install Nanana291/agent-system
```

Restart Qwen Code after installation.

## Bootstrap

1. Open the repository root.
2. Read `README.md` and `AGENTS.md`.
3. Read `QWEN.md` for the cross-host execution contract, then use this file for the host-specific install/bootstrap notes.
4. Load the active profile from `profiles/<profile>/profile.json` and its companion `AGENTS.md`.

## Qwen behavior

- Keep Superpowers in the process layer.
- Use Agent System for route selection, ownership, handoffs, and delivery gates.
- If a richer host integration is unavailable, work directly from the markdown artifacts.

## Failure mode

If Qwen cannot materialize a command or subagent feature, emit the required artifact in the chat or file output and keep the manifest consistent.

## Updating

```bash
qwen extensions update agent-system
```
