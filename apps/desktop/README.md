# Linguride Desktop App

This desktop application now lives under `apps/desktop` in the repository.

## Common Commands

Install dependencies once from the repository root:

```bash
npm install
```

Then run desktop commands from the repository root:

```bash
npm run build:desktop
npm run tauri:dev:desktop
npm run tauri:build:desktop
```

Or run from the desktop app directory after the root install:

```bash
cd apps/desktop
npm run build
```

## Template Notes

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
