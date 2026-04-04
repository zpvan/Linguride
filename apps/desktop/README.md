# Linguride Desktop App

The desktop application lives under `apps/desktop` and is now the first runtime
consumer of the shared Rust core introduced in Phase 5.

## Architecture

- `apps/desktop/src`: React + Vite desktop shell
- `apps/desktop/src-tauri`: Tauri backend and command bridge
- `crates/linguride-domain`: shared Rust DTOs returned to the desktop shell
- `crates/linguride-core`: reusable Rust analysis logic consumed by Tauri

The desktop shell is the only Rust consumer for now. Browser runtime remains
TypeScript-only, and mobile bindings are intentionally deferred.

## Common Commands

Install JavaScript dependencies once from the repository root:

```bash
npm install
```

Run frontend or packaged desktop commands from the repository root:

```bash
npm run build:desktop
npm run tauri:dev:desktop
npm run tauri:build:desktop
```

Validate the Rust workspace from the repository root:

```bash
npm run check:rust
npm run test:rust-core
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
