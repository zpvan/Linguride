#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

ARTIFACT="chrome-extension"
DIST_DIR="$REPO_ROOT/apps/browser-extension/dist"
OUTPUT_DIR="$(artifact_output_dir "$ARTIFACT")"
VERSION="$(artifact_package_version "$ARTIFACT")"
ZIP_PATH="$OUTPUT_DIR/lingride-chrome-extension-v${VERSION}.zip"

log_section "Chrome extension package"
bash "$(artifact_phase_script "$ARTIFACT" "build")"
assert_dir_exists "$DIST_DIR"
reset_dir "$OUTPUT_DIR"

(
  cd "$DIST_DIR"
  log_info "Creating archive: $ZIP_PATH"
  zip -qr "$ZIP_PATH" .
)

assert_file_exists "$ZIP_PATH"
log_info "Chrome extension package created: $ZIP_PATH"
