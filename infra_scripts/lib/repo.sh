#!/bin/bash

find_repo_root() {
  local current="$1"

  while [[ "$current" != "/" ]]; do
    if [[ -d "$current/infra_scripts" && -f "$current/package.json" ]]; then
      printf '%s\n' "$current"
      return 0
    fi
    current="$(dirname "$current")"
  done

  return 1
}

REPO_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(find_repo_root "$REPO_LIB_DIR")}"

if [[ -z "${REPO_ROOT:-}" ]]; then
  printf 'Failed to resolve repository root from %s\n' "$REPO_LIB_DIR" >&2
  exit 1
fi

readonly REPO_ROOT
export REPO_ROOT

cd_repo_root() {
  cd "$REPO_ROOT"
}
