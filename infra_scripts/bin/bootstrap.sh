#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

artifact="${1:-}"

if [[ -n "$artifact" ]]; then
  require_artifact "$artifact"
  doctor_artifact "$artifact"
  log_section "Bootstrap workspace for $artifact"
else
  doctor_common
  log_section "Bootstrap workspace"
fi

run_repo_cmd npm install

if [[ -f "$REPO_ROOT/Cargo.toml" ]] && command -v cargo >/dev/null 2>&1 && { [[ -z "$artifact" ]] || [[ "$artifact" == "macos-app" ]]; }; then
  log_info "Fetching Rust dependencies"
  run_repo_cmd cargo fetch --locked
fi

log_info "Bootstrap completed"
