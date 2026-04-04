#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

target="${1:-all}"

clean_shared_outputs() {
  rm -rf \
    "$REPO_ROOT/packages/contracts-ts/dist" \
    "$REPO_ROOT/packages/prompt-kits/dist" \
    "$REPO_ROOT/packages/text-assistant-core/dist"
}

clean_chrome_extension() {
  rm -rf \
    "$REPO_ROOT/apps/browser-extension/dist" \
    "$(artifact_output_dir chrome-extension)"
}

clean_macos_app() {
  rm -rf \
    "$REPO_ROOT/apps/desktop/dist" \
    "$REPO_ROOT/target" \
    "$(artifact_output_dir macos-app)"
}

clean_vscode_extension() {
  rm -rf \
    "$REPO_ROOT/apps/vscode-extension/out" \
    "$(artifact_output_dir vscode-extension)"
  find "$REPO_ROOT/apps/vscode-extension" -maxdepth 1 -type f -name '*.vsix' -delete
}

log_section "Clean: $target"

case "$target" in
  all)
    clean_shared_outputs
    clean_chrome_extension
    clean_macos_app
    clean_vscode_extension
    ;;
  chrome-extension)
    clean_shared_outputs
    clean_chrome_extension
    ;;
  macos-app)
    clean_shared_outputs
    clean_macos_app
    ;;
  vscode-extension)
    clean_shared_outputs
    clean_vscode_extension
    ;;
  *)
    die "Unsupported clean target: $target"
    ;;
esac

log_info "Clean completed"
