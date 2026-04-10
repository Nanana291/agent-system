# agent-system bash completion
# Install: source completion.bash  (or add to ~/.bashrc)
# Usage: agent-system <TAB><TAB>

_agent_system_completions() {
  local cur="${COMP_WORDS[COMP_CWORD]}"
  local prev="${COMP_WORDS[COMP_CWORD-1]}"

  local commands="version doctor lock route explain gate profile sync init memory brain status dashboard upgrade train eval backup restore change quick-fix quick-update luau-quick luau-explain luau-diagnose luau-repair luau-gate project-lint luau-inspect luau-perf-profile luau-dead-code luau-pcall-audit luau-verify-flow luau-compat-check luau-snapshot luau-report luau-inspect luau-regression-gate luau-remote-map luau-security-scan luau-complexity luau-verify-features luau-ui-map brain-import brain-export brain-stats brain-diff luau-docgen luau-refactor luau-symbol-map luau-chunk luau-baseline luau-diff-report bundle-validate bundle-diff bundle-prune metrics metrics-trend metrics-compare help"

  local brain_actions="add query explain promote demote prune dedupe snapshot restore diff sync list stats export import"
  local memory_actions="list add search promote prune audit stats status capture review compress teach gate reflect packs learn snapshot restore diff rollback"
  local upgrade_actions="status preview learn apply sync report replay docs profile memory hosts cycle"
  local status_actions="show who set heartbeat attach watch clear list"
  local train_actions="explain compare packs rollback"
  local bundle_actions="validate diff prune"
  local metrics_actions="trend compare"

  if [[ ${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${commands}" -- "${cur}") )
    return 0
  fi

  local cmd="${COMP_WORDS[1]}"

  case "${cmd}" in
    brain)
      COMPREPLY=( $(compgen -W "${brain_actions}" -- "${cur}") )
      ;;
    memory)
      COMPREPLY=( $(compgen -W "${memory_actions}" -- "${cur}") )
      ;;
    upgrade)
      COMPREPLY=( $(compgen -W "${upgrade_actions}" -- "${cur}") )
      ;;
    status)
      COMPREPLY=( $(compgen -W "${status_actions}" -- "${cur}") )
      ;;
    train)
      COMPREPLY=( $(compgen -W "${train_actions}" -- "${cur}") )
      ;;
    bundle)
      COMPREPLY=( $(compgen -W "${bundle_actions}" -- "${cur}") )
      ;;
    metrics)
      COMPREPLY=( $(compgen -W "${metrics_actions}" -- "${cur}") )
      ;;
    *)
      # File completion for file-accepting commands
      case "${cmd}" in
        luau-*|lock|route|explain)
          COMPREPLY=( $(compgen -f -- "${cur}") )
          ;;
      esac
      ;;
  esac
}

complete -F _agent_system_completions agent-system
complete -F _agent_system_completions node  # For "node bin/agent-system.mjs" usage
