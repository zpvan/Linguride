#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

ARTIFACT="chrome-extension"
DIST_DIR="$REPO_ROOT/apps/browser-extension/dist"
OUTPUT_DIR="$(artifact_output_dir "$ARTIFACT")"

log_section "Chrome extension smoke"
assert_file_exists "$DIST_DIR/manifest.json"
assert_file_exists "$DIST_DIR/src/background/service-worker.js"
assert_file_exists "$DIST_DIR/src/content/index.js"
assert_file_exists "$DIST_DIR/src/sidepanel/sidepanel.html"
assert_file_exists "$DIST_DIR/icons/icon16.png"

zip_file="$(find_first_file "$OUTPUT_DIR" '*.zip')"
[[ -n "$zip_file" ]] || die "No chrome-extension zip package found in $OUTPUT_DIR"
assert_file_exists "$zip_file"

log_info "Chrome extension smoke checks passed"
