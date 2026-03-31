#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

ARTIFACT="macos-app"
OUTPUT_DIR="$(artifact_output_dir "$ARTIFACT")"

require_os macos

log_section "macOS app smoke"
assert_dir_exists "$OUTPUT_DIR"

app_count="$(find "$OUTPUT_DIR" -maxdepth 2 -type d -name '*.app' | wc -l | tr -d ' ')"
dmg_count="$(find "$OUTPUT_DIR" -maxdepth 2 -type f -name '*.dmg' | wc -l | tr -d ' ')"

if [[ "$app_count" -eq 0 && "$dmg_count" -eq 0 ]]; then
  die "No .app or .dmg artifact found in $OUTPUT_DIR"
fi

log_info "macOS app smoke checks passed"
