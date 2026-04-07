# Generic Host Memory

Host-agnostic adaptation notes live here when the rule applies across Claude, Codex, and Qwen.

## Usage

- Use this as the fallback host memory file.
- Promote a rule to a specific host file only when the host behavior differs.

## Initial notes

- Emit markdown artifacts when a host cannot support a richer command or subagent form.
- Keep the structured manifest authoritative over host-specific convenience.
