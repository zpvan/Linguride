# Bindings

This directory contains platform-specific bindings that expose the shared Rust
core to non-native consumers.

Current policy:

- `bindings/web-core` is the browser-facing WASM bridge for `apps/browser-extension`.
- `apps/desktop/src-tauri` consumes the same Rust core natively through Tauri commands.
- Browser runtime keeps a TypeScript shell for DOM, extension lifecycle, and UI,
  but no longer owns business-core logic.
- iOS and Android bindings remain deferred until the browser and desktop flows
  stabilize on the same Rust-first contracts.
