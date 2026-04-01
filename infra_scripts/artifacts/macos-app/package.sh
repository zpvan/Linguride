#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

ARTIFACT="macos-app"
OUTPUT_DIR="$(artifact_output_dir "$ARTIFACT")"
VERSION="$(artifact_package_version "$ARTIFACT")"

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

clean_macos_bundles() {
  local bundle_root
  for bundle_root in \
    "$REPO_ROOT/target/release/bundle" \
    "$REPO_ROOT/apps/desktop/src-tauri/target/release/bundle"
  do
    [[ -d "$bundle_root" ]] || continue
    log_info "Removing stale bundle output: $bundle_root"
    rm -rf "$bundle_root"
  done
}

archive_app_bundle() {
  local app_path="$1"
  local app_name
  local archive_path

  app_name="$(basename "$app_path" .app)"
  archive_path="$OUTPUT_DIR/${app_name}-v${VERSION}.tar.gz"

  log_info "Creating macOS preview archive: $archive_path"
  tar -czf "$archive_path" -C "$(dirname "$app_path")" "$(basename "$app_path")"
  assert_file_exists "$archive_path"
}

require_os macos

log_section "macOS app package"
reset_dir "$OUTPUT_DIR"
clean_macos_bundles
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

while IFS= read -r app_path; do
  [[ -n "$app_path" ]] || continue
  archive_app_bundle "$app_path"
done < <(find "$OUTPUT_DIR" -maxdepth 1 -type d -name '*.app' -print)

log_info "macOS app package copied to $OUTPUT_DIR"
