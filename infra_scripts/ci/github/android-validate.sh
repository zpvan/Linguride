#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

log_section "GitHub CI test: android"

require_command bash
require_command java
require_command cargo

if ! run_repo_cmd cargo ndk --version >/dev/null 2>&1; then
  die "cargo-ndk is required. Install it with: cargo install cargo-ndk --locked"
fi

if [[ -z "${ANDROID_SDK_ROOT:-}" && -n "${ANDROID_HOME:-}" ]]; then
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
fi

if [[ -z "${ANDROID_NDK_HOME:-}" && -n "${ANDROID_NDK_ROOT:-}" ]]; then
  export ANDROID_NDK_HOME="$ANDROID_NDK_ROOT"
fi

if [[ -z "${ANDROID_NDK_HOME:-}" && -n "${ANDROID_SDK_ROOT:-}" ]]; then
  latest_ndk_dir="$(find "$ANDROID_SDK_ROOT/ndk" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1 || true)"
  if [[ -n "${latest_ndk_dir}" ]]; then
    export ANDROID_NDK_HOME="$latest_ndk_dir"
    export ANDROID_NDK_ROOT="$latest_ndk_dir"
  fi
fi

if [[ -z "${ANDROID_SDK_ROOT:-}" ]]; then
  die "ANDROID_SDK_ROOT must be set"
fi

if [[ -z "${ANDROID_NDK_HOME:-}" ]]; then
  die "ANDROID_NDK_HOME or ANDROID_NDK_ROOT must be set"
fi

log_info "ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT"
log_info "ANDROID_NDK_HOME=$ANDROID_NDK_HOME"
print_command_version bash
print_command_version java
print_command_version cargo

run_repo_cmd cargo test -p mobile-core

log_section "Android Gradle validate"
(
  cd "$REPO_ROOT/apps/android"
  ./gradlew --no-daemon --stacktrace :app:assembleDebug testDebugUnitTest compileDebugAndroidTestKotlin
)
