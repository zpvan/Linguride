#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

target="${1:-all}"

clean_shared_outputs() {
  rm -rf \
    "$REPO_ROOT/packages/contracts-ts/dist"
}

clean_chrome_extension() {
  rm -rf \
    "$REPO_ROOT/apps/browser-extension/dist" \
    "$(artifact_output_dir chrome-extension)"
}

log_section "Clean: $target"

case "$target" in
  all | chrome-extension)
    clean_shared_outputs
    clean_chrome_extension
    ;;
  *)
    die "Unsupported clean target: $target"
    ;;
esac

log_info "Clean completed"
