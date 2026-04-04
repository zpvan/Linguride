#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

require_os macos

log_section "macOS app build"
run_repo_cmd npm run build:desktop
log_info "macOS app build finished"
