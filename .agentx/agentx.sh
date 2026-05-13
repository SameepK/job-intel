#!/usr/bin/env bash
set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_relative='.github/agentx/.agentx/agentx.sh'

resolve_agentx_extension_root() {
  local candidate=""

  if [[ -n "${AGENTX_EXTENSION_ROOT:-}" && -f "${AGENTX_EXTENSION_ROOT}/${runtime_relative}" ]]; then
    printf '%s\n' "$AGENTX_EXTENSION_ROOT"
    return 0
  fi

  candidate='/Users/sameepkotecha/.vscode/extensions/jnpiyush.agentx-8.4.50'
  if [[ -f "${candidate}/${runtime_relative}" ]]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  local search_root=""
  local match=""
  for search_root in "$HOME/.vscode/extensions" "$HOME/.vscode-insiders/extensions"; do
    [[ -d "$search_root" ]] || continue
    while IFS= read -r match; do
      if [[ -f "${match}/${runtime_relative}" ]]; then
        printf '%s\n' "$match"
        return 0
      fi
    done < <(find "$search_root" -maxdepth 1 -mindepth 1 -type d -name 'jnpiyush.agentx-*' | sort -r)
  done

  echo 'AgentX extension runtime not found. Reinstall the AgentX extension or set AGENTX_EXTENSION_ROOT.' >&2
  return 1
}

extension_root="$(resolve_agentx_extension_root)"
export AGENTX_WORKSPACE_ROOT="$workspace_root"
exec "${extension_root}/${runtime_relative}" "$@"
