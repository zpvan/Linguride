# GEMINI.md - Linguride Project Context

This document provides an overview of the Linguride project, its structure, and development guidelines for AI-assisted development.

## 1. Project Overview

**Linguride** is an AI-powered English learning project based on the "Bicycle Method" – immersive, contextual language acquisition. The long-term product vision (multi-platform: desktop, mobile, IDE) lives in `docs/Linguride-PRD.md` (Chinese).

**Current status**: the repository maintains a single product — the **Chrome browser extension "Lingride"** (`apps/browser-extension`). The Android, desktop (Tauri) and VS Code extension codebases were removed in September 2026 (commit `bdbee63`) as they were no longer in use.

## 2. Repository Layout

```
apps/browser-extension/   # Chrome MV3 extension (the only artifact)
packages/contracts-ts/    # Shared TS contracts (DTOs / config types); direct dependency of the extension
bindings/web-core/        # Rust → WASM bindings (wasm-bindgen) consumed by the extension
crates/linguride-core/    # Rust core logic (reader / tutor / corpus / session / ...)
crates/linguride-domain/  # Rust domain models
infra_scripts/            # Build & CI scripts (artifact-based; only chrome-extension remains)
docs/, feat-docs/, spec/  # Product docs — the PRD describes future platforms, not current state
```

## 3. `apps/browser-extension` (Chrome Extension)

Tech stack: TypeScript + Vite + `vite-plugin-web-extension`, Manifest V3, framework-free DOM.

*   **Side panel** (`src/sidepanel/`): clicking the toolbar icon opens the extension in Chrome's right-hand side panel (`chrome.sidePanel` + `openPanelOnActionClick`, Chrome 114+) instead of a popup. Main view = learning control center; settings view is reached via the gear icon (top right). Keyboard shortcut: Cmd/Ctrl+Shift+Y.
*   **Background service worker** (`src/background/`): message routing, AI API calls, config storage, TTS synthesis tasks, ASR auth (Doubao ASR injects WS auth headers via a declarativeNetRequest session rule).
*   **Content scripts** (`src/content/`): reading modes (paraphrase / mixed / bilingual translation), selection popup, page text extraction.
*   **Full-tab pages**: `src/tutor/` (sentence analysis, pronunciation assessment, shadowing), `src/corpus/` (listening training).
*   **Offscreen document** (`src/offscreen/`): plays TTS audio in extension context to bypass page CSP.
*   **Permissions page** (`src/permissions/`): microphone authorization (the side panel cannot request it directly).

Configurable service providers (all with "test connection" in settings):
*   **AI**: DeepSeek / GLM / MiniMax / OpenAI (API key or ChatGPT OAuth) / custom endpoint
*   **TTS**: MiniMax / Xiaomi / Doubao / browser speech (auto-fallback to browser)
*   **ASR**: MiniMax / Xiaomi / Doubao / browser — same ordering as TTS; ASR reuses the matching TTS API key by default (see `resolveDoubaoASRApiKey` / `resolveXiaomiASRApiKey` / `isMiniMaxASRConfigured` in `src/types/config.ts`)

### Getting Started

From the repository root (builds the wasm + contracts dependencies first):

```bash
npm run typecheck:browser-extension
npm run lint:browser-extension
npm run build:browser-extension   # outputs to apps/browser-extension/dist
npm run test --workspace apps/browser-extension --if-present   # set CI=true locally to avoid vitest watch mode
```

Or inside `apps/browser-extension/`: `npm run dev / build / typecheck / lint`, `npx vitest run`.

Load the unpacked extension from `apps/browser-extension/dist` via `chrome://extensions`.

## 4. CI

*   **GitHub Actions** (`.github/workflows/ci.yml`): single-artifact pipeline — `validate` (typecheck/lint/build/test) → `package` (zip) → `smoke`. Entry points: `infra_scripts/ci/github/*.sh` → `infra_scripts/artifacts/chrome-extension/*.sh`.
*   The smoke script hard-codes build output paths (e.g. `dist/src/sidepanel/sidepanel.html`); keep `infra_scripts/artifacts/chrome-extension/smoke.sh` in sync when renaming entry files.
*   **Jenkins**: root `Jenkinsfile` runs the browser-extension gate.

## 5. Conventions

*   Commit messages: Conventional Commits with scope, Chinese descriptions, e.g. `fix(browser-extension): ...`.
*   Source files carry a Chinese `@file` / `@description` header comment block; keep the style for new files.
*   UI copy and code comments are primarily in Chinese.
*   Opening the side panel via `openPanelOnActionClick` does **not** grant `activeTab`; `chrome.scripting.executeScript` relies on the `<all_urls>` host permission in the manifest.
