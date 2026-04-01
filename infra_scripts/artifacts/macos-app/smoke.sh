#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

ARTIFACT="macos-app"
OUTPUT_DIR="$(artifact_output_dir "$ARTIFACT")"

require_os macos

log_section "macOS app smoke"
assert_dir_exists "$OUTPUT_DIR"

dmg_count="$(find "$OUTPUT_DIR" -maxdepth 2 -type f -name '*.dmg' | wc -l | tr -d ' ')"
archive_count="$(find "$OUTPUT_DIR" -maxdepth 2 -type f -name '*.tar.gz' | wc -l | tr -d ' ')"

if [[ "$archive_count" -eq 0 && "$dmg_count" -eq 0 ]]; then
  die "No downloadable macOS artifact (.tar.gz or .dmg) found in $OUTPUT_DIR"
fi

log_info "macOS app smoke checks passed"
