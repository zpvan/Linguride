#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

ARTIFACT="vscode-extension"
APP_DIR="$REPO_ROOT/apps/vscode-extension"
OUTPUT_DIR="$(artifact_output_dir "$ARTIFACT")"

log_section "VS Code extension smoke"
assert_file_exists "$APP_DIR/out/extension.js"

vsix_file="$(find_first_file "$OUTPUT_DIR" '*.vsix')"
[[ -n "$vsix_file" ]] || die "No VSIX package found in $OUTPUT_DIR"
assert_file_exists "$vsix_file"

log_info "VS Code extension smoke checks passed"
