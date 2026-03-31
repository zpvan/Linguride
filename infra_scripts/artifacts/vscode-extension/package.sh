#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

ARTIFACT="vscode-extension"
APP_DIR="$REPO_ROOT/apps/vscode-extension"
OUTPUT_DIR="$(artifact_output_dir "$ARTIFACT")"
PACKAGE_NAME="$(artifact_package_name "$ARTIFACT")"
VERSION="$(artifact_package_version "$ARTIFACT")"
VSIX_PATH="$OUTPUT_DIR/${PACKAGE_NAME}-${VERSION}.vsix"
NPM_CACHE_DIR="$REPO_ROOT/infra_scripts/out/.npm-cache"
STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/linguride-vscode-stage.XXXXXX")"

cleanup() {
  rm -rf "$STAGING_DIR"
}

prepare_staging() {
  mkdir -p "$STAGING_DIR/node_modules" "$STAGING_DIR/node_modules/@linguride"

  node - "$APP_DIR/package.json" "$STAGING_DIR/package.json" <<'NODE'
const fs = require("fs");

const sourcePath = process.argv[2];
const targetPath = process.argv[3];
const pkg = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

if (pkg.scripts) {
  delete pkg.scripts["vscode:prepublish"];
}

fs.writeFileSync(targetPath, `${JSON.stringify(pkg, null, 2)}\n`);
NODE
  cp "$APP_DIR/README.md" "$STAGING_DIR/"
  cp "$APP_DIR/CHANGELOG.md" "$STAGING_DIR/"
  cp -R "$APP_DIR/media" "$STAGING_DIR/"
  cp -R "$APP_DIR/out" "$STAGING_DIR/"
}

copy_runtime_dependencies() {
  local dependency_path
  while IFS= read -r dependency_path; do
    [[ -n "$dependency_path" ]] || continue
    case "$dependency_path" in
      "$REPO_ROOT"|"$REPO_ROOT/node_modules/linguride-english-difficulty-analyzer")
        continue
        ;;
      "$REPO_ROOT"/node_modules/@linguride/*)
        cp -R -L "$dependency_path" "$STAGING_DIR/node_modules/@linguride/"
        ;;
      "$APP_DIR"/node_modules/*)
        cp -R -L "$dependency_path" "$STAGING_DIR/node_modules/"
        ;;
    esac
  done < <(
    cd "$REPO_ROOT" && \
      npm ls --omit=dev --parseable --all --workspace apps/vscode-extension 2>/dev/null | sed '/^$/d'
  )
}

trap cleanup EXIT

log_section "VS Code extension package"
bash "$(artifact_phase_script "$ARTIFACT" "build")"
reset_dir "$OUTPUT_DIR"
ensure_dir "$NPM_CACHE_DIR"
prepare_staging
copy_runtime_dependencies

(
  cd "$STAGING_DIR"
  log_info "Packaging VSIX to $VSIX_PATH"
  NPM_CONFIG_CACHE="$NPM_CACHE_DIR" npm exec --yes --package=@vscode/vsce -- vsce package --out "$VSIX_PATH"
)

assert_file_exists "$VSIX_PATH"
log_info "VS Code extension package created: $VSIX_PATH"
