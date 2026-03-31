#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

log_section "VS Code extension build"
run_repo_cmd npm run compile:vscode
log_info "VS Code extension build finished"
