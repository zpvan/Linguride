#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

artifact="${1:-}"
wasm_target="wasm32-unknown-unknown"
npm_cache_dir="${NPM_CONFIG_CACHE:-$REPO_ROOT/infra_scripts/out/.npm-cache}"

install_npm_dependencies() {
  local npm_subcommand
  local workspace
  local -a npm_cmd

  if [[ -n "${CI:-}" ]] && [[ -f "$REPO_ROOT/package-lock.json" ]]; then
    npm_subcommand="ci"
  else
    npm_subcommand="install"
  fi

  npm_cmd=(env "NPM_CONFIG_CACHE=$npm_cache_dir" npm "$npm_subcommand")

  if [[ -n "$artifact" ]]; then
    npm_cmd+=(--include-workspace-root)
    while IFS= read -r workspace; do
      [[ -n "$workspace" ]] || continue
      npm_cmd+=(--workspace "$workspace")
    done < <(artifact_install_workspaces "$artifact")
  fi

  run_repo_cmd "${npm_cmd[@]}"
}

resolve_browser_extension_rollup_version() {
  node - "$REPO_ROOT" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.argv[2];
const packageJsonPath = path.join(
  repoRoot,
  "apps/browser-extension/node_modules/vite/node_modules/rollup/package.json"
);
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

if (!packageJson.version) {
  process.exit(1);
}

process.stdout.write(packageJson.version);
NODE
}

has_browser_extension_linux_rollup_native() {
  node - "$REPO_ROOT" <<'NODE'
const path = require("node:path");

const repoRoot = process.argv[2];
const rollupDistPath = path.join(
  repoRoot,
  "apps/browser-extension/node_modules/vite/node_modules/rollup/dist"
);

try {
  require.resolve("@rollup/rollup-linux-x64-gnu", { paths: [rollupDistPath] });
  process.exit(0);
} catch {
  process.exit(1);
}
NODE
}

ensure_browser_extension_linux_rollup_native() {
  local rollup_version
  local current_arch

  [[ -n "${CI:-}" ]] || return 0
  [[ "$artifact" == "chrome-extension" ]] || return 0
  [[ "$(detect_os)" == "linux" ]] || return 0

  current_arch="$(uname -m)"
  case "$current_arch" in
    x86_64|amd64)
      ;;
    *)
      die "Chrome extension CI expects a Linux x64 runner for Rollup native repair, found: $current_arch"
      ;;
  esac

  if has_browser_extension_linux_rollup_native; then
    log_info "Browser extension Rollup native package already available for Linux x64"
    return
  fi

  rollup_version="$(resolve_browser_extension_rollup_version)"
  [[ -n "$rollup_version" ]] || die "Failed to resolve browser extension Rollup version"

  log_warn "Browser extension Rollup native package is missing after npm ci; triggering Linux repair path"
  run_repo_cmd env NPM_CONFIG_CACHE="$npm_cache_dir" npm install --workspace apps/browser-extension --no-save --ignore-scripts "@rollup/rollup-linux-x64-gnu@$rollup_version"

  has_browser_extension_linux_rollup_native || die "Failed to install @rollup/rollup-linux-x64-gnu@$rollup_version for browser extension"
  log_info "Verified browser extension Rollup native package after Linux repair path"
}

resolve_wasm_bindgen_version() {
  awk '
    $0 == "name = \"wasm-bindgen\"" { found = 1; next }
    found && $1 == "version" {
      gsub(/"/, "", $3)
      print $3
      exit
    }
  ' "$REPO_ROOT/Cargo.lock"
}

ensure_wasm_target() {
  require_command rustup

  if rustup target list --installed | grep -qx "$wasm_target"; then
    log_info "Rust target already installed: $wasm_target"
    return
  fi

  log_info "Installing Rust target: $wasm_target"
  run_repo_cmd rustup target add "$wasm_target"
}

ensure_wasm_bindgen_cli() {
  local bindgen_bin="$REPO_ROOT/.tools/bin/wasm-bindgen"
  local expected_version
  local current_version=""

  expected_version="$(resolve_wasm_bindgen_version)"
  [[ -n "$expected_version" ]] || die "Failed to resolve wasm-bindgen version from Cargo.lock"

  if [[ -x "$bindgen_bin" ]]; then
    current_version="$("$bindgen_bin" --version 2>/dev/null | awk '{ print $2 }')"
  fi

  if [[ "$current_version" == "$expected_version" ]]; then
    log_info "wasm-bindgen CLI already installed: $current_version"
    return
  fi

  if [[ -n "$current_version" ]]; then
    log_info "Updating wasm-bindgen CLI from $current_version to $expected_version"
  else
    log_info "Installing wasm-bindgen CLI: $expected_version"
  fi

  run_repo_cmd cargo install --root ./.tools wasm-bindgen-cli --version "$expected_version" --locked --force
}

if [[ -n "$artifact" ]]; then
  require_artifact "$artifact"
  doctor_artifact "$artifact"
  log_section "Bootstrap workspace for $artifact"
else
  doctor_common
  log_section "Bootstrap workspace"
fi

ensure_dir "$npm_cache_dir"
log_info "Using npm cache: $npm_cache_dir"

install_npm_dependencies

ensure_browser_extension_linux_rollup_native

if [[ -f "$REPO_ROOT/Cargo.toml" ]] && command -v cargo >/dev/null 2>&1 && { [[ -z "$artifact" ]] || [[ "$artifact" == "chrome-extension" ]] || [[ "$artifact" == "macos-app" ]]; }; then
  log_info "Fetching Rust dependencies"
  run_repo_cmd cargo fetch --locked
fi

if [[ -f "$REPO_ROOT/Cargo.toml" ]] && command -v cargo >/dev/null 2>&1 && { [[ -z "$artifact" ]] || [[ "$artifact" == "chrome-extension" ]]; }; then
  ensure_wasm_target
  ensure_wasm_bindgen_cli
fi

log_info "Bootstrap completed"
