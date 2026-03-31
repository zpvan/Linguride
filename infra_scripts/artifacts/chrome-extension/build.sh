#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

log_section "Chrome extension build"
run_repo_cmd npm run build:browser-extension
log_info "Chrome extension build finished"
