#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

require_os macos

log_section "macOS app test gate"
run_repo_cmd npm run build:desktop
run_repo_cmd npm run test:rust
run_repo_cmd npm run test:web-core:wasm
log_info "macOS app test gate passed"
