#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

artifact="${1:-}"
wasm_target="wasm32-unknown-unknown"
npm_cache_dir="${NPM_CONFIG_CACHE:-$REPO_ROOT/infra_scripts/out/.npm-cache}"

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

if [[ -n "${CI:-}" ]] && [[ -f "$REPO_ROOT/package-lock.json" ]]; then
  run_repo_cmd env NPM_CONFIG_CACHE="$npm_cache_dir" npm ci
else
  run_repo_cmd env NPM_CONFIG_CACHE="$npm_cache_dir" npm install
fi

if [[ -f "$REPO_ROOT/Cargo.toml" ]] && command -v cargo >/dev/null 2>&1 && { [[ -z "$artifact" ]] || [[ "$artifact" == "chrome-extension" ]] || [[ "$artifact" == "macos-app" ]]; }; then
  log_info "Fetching Rust dependencies"
  run_repo_cmd cargo fetch --locked
fi

if [[ -f "$REPO_ROOT/Cargo.toml" ]] && command -v cargo >/dev/null 2>&1 && { [[ -z "$artifact" ]] || [[ "$artifact" == "chrome-extension" ]]; }; then
  ensure_wasm_target
  ensure_wasm_bindgen_cli
fi

log_info "Bootstrap completed"
