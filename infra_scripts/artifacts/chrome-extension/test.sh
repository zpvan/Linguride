#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

log_section "Chrome extension test gate"
run_repo_cmd npm run typecheck:browser-extension
run_repo_cmd npm run lint:browser-extension
run_repo_cmd npm run build:browser-extension
run_repo_cmd npm run test --workspace apps/browser-extension --if-present
log_info "Chrome extension test gate passed"
