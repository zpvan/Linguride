#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

APP_DIR="$REPO_ROOT/apps/vscode-extension"
COMPILED_TEST_ENTRY="$APP_DIR/out/test/runTest.js"

log_section "VS Code extension test gate"
run_repo_cmd npm run compile:vscode

if [[ -f "$COMPILED_TEST_ENTRY" ]]; then
  run_repo_cmd npm run test:vscode
else
  log_warn "No compiled VS Code test entrypoint found at $COMPILED_TEST_ENTRY; skipping extension-host tests."
fi

log_info "VS Code extension test gate passed"
