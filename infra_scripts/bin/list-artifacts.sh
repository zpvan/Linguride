#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

format="${1:-text}"

if [[ "$format" == "--json" ]]; then
  printf '[\n'
  for index in "${!SUPPORTED_ARTIFACTS[@]}"; do
    artifact="${SUPPORTED_ARTIFACTS[$index]}"
    comma=','
    if [[ "$index" -eq $((${#SUPPORTED_ARTIFACTS[@]} - 1)) ]]; then
      comma=''
    fi
    printf '  {"id":"%s","app":"%s","os":"%s","phases":["build","test","package","smoke"]}%s\n' \
      "$artifact" \
      "$(artifact_app_dir "$artifact")" \
      "$(artifact_required_os "$artifact")" \
      "$comma"
  done
  printf ']\n'
  exit 0
fi

for artifact in "${SUPPORTED_ARTIFACTS[@]}"; do
  printf '%s\t%s\t%s\n' \
    "$artifact" \
    "$(artifact_app_dir "$artifact")" \
    "$(artifact_required_os "$artifact")"
done
