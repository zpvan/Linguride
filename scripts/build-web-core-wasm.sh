#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/apps/browser-extension/public/web-core"
WASM_TARGET="wasm32-unknown-unknown"
WASM_ARTIFACT="$ROOT_DIR/target/$WASM_TARGET/release/web_core.wasm"
BINDGEN_BIN="$ROOT_DIR/.tools/bin/wasm-bindgen"

if ! command -v cargo >/dev/null 2>&1; then
  echo "cargo is required to build bindings/web-core." >&2
  exit 1
fi

if ! rustup target list --installed | grep -qx "$WASM_TARGET"; then
  echo "Missing Rust target: $WASM_TARGET" >&2
  echo "Run: rustup target add $WASM_TARGET" >&2
  exit 1
fi

if [[ ! -x "$BINDGEN_BIN" ]]; then
  echo "Missing wasm-bindgen CLI at $BINDGEN_BIN" >&2
  echo "Install it with: cargo install --root ./.tools wasm-bindgen-cli" >&2
  exit 1
fi

cargo build -p web-core --target "$WASM_TARGET" --release
mkdir -p "$OUT_DIR"
"$BINDGEN_BIN" "$WASM_ARTIFACT" --out-dir "$OUT_DIR" --target web
