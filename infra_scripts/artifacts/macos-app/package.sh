#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

ARTIFACT="macos-app"
OUTPUT_DIR="$(artifact_output_dir "$ARTIFACT")"

find_macos_bundles() {
  local bundle_root
  for bundle_root in \
    "$REPO_ROOT/target/release/bundle" \
    "$REPO_ROOT/apps/desktop/src-tauri/target/release/bundle"
  do
    [[ -d "$bundle_root" ]] || continue
    find "$bundle_root" \( -type d -name '*.app' -o -type f -name '*.dmg' \) -print
  done
}

require_os macos

log_section "macOS app package"
reset_dir "$OUTPUT_DIR"
run_repo_cmd npm run build:packages
run_repo_cmd npm --workspace apps/desktop run tauri -- build --bundles app

copied=0
while IFS= read -r bundle_path; do
  [[ -n "$bundle_path" ]] || continue
  copied=1
  log_info "Copying bundle artifact: $bundle_path"
  if [[ -d "$bundle_path" ]]; then
    cp -R "$bundle_path" "$OUTPUT_DIR/"
  else
    cp "$bundle_path" "$OUTPUT_DIR/"
  fi
done < <(find_macos_bundles)

[[ "$copied" -eq 1 ]] || die "No macOS bundle artifacts were found after tauri build"
log_info "macOS app package copied to $OUTPUT_DIR"
