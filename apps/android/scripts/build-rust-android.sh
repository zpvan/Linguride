#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${ANDROID_DIR}/../.." && pwd)"
OUT_DIR="${ANDROID_DIR}/core-mobile-bridge/build/generated/jniLibs"

if [[ -z "${ANDROID_NDK_HOME:-}" && -n "${ANDROID_NDK_ROOT:-}" ]]; then
  export ANDROID_NDK_HOME="${ANDROID_NDK_ROOT}"
fi

if [[ -z "${ANDROID_NDK_HOME:-}" && -n "${ANDROID_SDK_ROOT:-}" ]]; then
  latest_ndk_dir="$(find "${ANDROID_SDK_ROOT}/ndk" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1 || true)"
  if [[ -n "${latest_ndk_dir}" ]]; then
    export ANDROID_NDK_HOME="${latest_ndk_dir}"
    export ANDROID_NDK_ROOT="${latest_ndk_dir}"
  fi
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "cargo is required to build mobile-core." >&2
  exit 1
fi

if ! cargo ndk --version >/dev/null 2>&1; then
  echo "cargo-ndk is required. Install it with: cargo install cargo-ndk --locked" >&2
  exit 1
fi

if [[ -z "${ANDROID_NDK_HOME:-}" ]]; then
  echo "ANDROID_NDK_HOME/ANDROID_NDK_ROOT is not set, and no NDK was found under ANDROID_SDK_ROOT." >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"

cd "${REPO_ROOT}"
cargo ndk \
  --platform 28 \
  -t arm64-v8a \
  -t x86_64 \
  -o "${OUT_DIR}" \
  build -p mobile-core --release
