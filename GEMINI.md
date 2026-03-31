# GEMINI.md - Linguride Project Context

This document provides an overview of the Linguride project, its structure, and development guidelines for AI-assisted development.

## 1. Project Overview

**Linguride** is an AI-powered ecosystem for English language learning, centered around the "Bicycle Method" – an immersive, conversational approach to language acquisition. The project aims to help users move from passive knowledge to active, instinctual use of English.

The repository is a monorepo containing three primary, independent application directories under `apps/`:

1.  **`apps/browser-extension`**: A Chrome browser extension for web reading, translation, tutor, and corpus workflows.
2.  **`apps/desktop`**: The core cross-platform desktop application where users practice speaking with an AI.
3.  **`apps/vscode-extension`**: A Visual Studio Code extension that analyzes the difficulty of English text, acting as a supplementary tool for learners or content creators.

### Key Documentation
*   **Product Requirements (PRD)**: `docs/Linguride-PRD.md` contains the vision, user personas, feature breakdown, and technical architecture.
*   **High-level AI Context**: `CLAUDE.md` provides an initial overview given to another AI.

---

## 2. `apps/desktop` (Tauri Desktop App)

This is the main user-facing application.

### 2.1. Purpose & Architecture

*   **Function**: A cross-platform (macOS, Windows, Linux) desktop application for conversational English practice.
*   **Frontend**: React with TypeScript, built with Vite.
*   **Backend/Wrapper**: Tauri (using a Rust backend), which provides a lightweight webview.
*   **Styling**: The PRD specifies Tailwind CSS.
*   **State Management**: The PRD specifies Zustand.
*   **Build/Package Toolchain**: The PRD specifies Bun.

### 2.2. Getting Started

**Prerequisites:**
*   Node.js and npm/yarn/pnpm.
*   Rust and Cargo.
*   Tauri prerequisites (see [Tauri documentation](https://tauri.app/v1/guides/getting-started/prerequisites)).

**Key Commands (from `apps/desktop/package.json`):**

*   **Install dependencies:**
    ```bash
    cd apps/desktop
    npm install
    ```
*   **Run in development mode:** This will launch the Tauri app with hot-reloading for the frontend.
    ```bash
    cd apps/desktop
    npm run tauri dev
    ```
*   **Build the application:** This compiles the frontend and bundles it into a final executable.
    ```bash
    cd apps/desktop
    npm run tauri build
    ```

### 2.3. Development Conventions

*   The frontend code resides in `apps/desktop/src`.
*   The Tauri-specific Rust code is in `apps/desktop/src-tauri`.
*   Tauri commands (Rust functions callable from the frontend) are defined in `apps/desktop/src-tauri/src/main.rs`.

---

## 3. `apps/vscode-extension` (English Difficulty Analyzer)

A tool for developers and writers to analyze the complexity of English text within VS Code.

### 3.1. Purpose & Architecture

*   **Function**: Analyzes selected English text using an LLM (OpenAI, Claude, or DeepSeek) to provide a detailed difficulty report (CEFR level, vocabulary/sentence complexity, etc.).
*   **Tech Stack**: TypeScript, using the VS Code Extension API.
*   **Key Features**:
    *   Right-click context menu integration.
    *   Command Palette access.
    *   A dedicated sidebar view for history and results.
    *   Configurable API keys and provider choice.

### 3.2. Getting Started

**Prerequisites:**
*   Node.js and npm.
*   Visual Studio Code.

**Key Commands (from `apps/vscode-extension/package.json`):**

*   **Install dependencies:**
    ```bash
    cd apps/vscode-extension
    npm install
    ```
*   **Run in development mode:** This compiles the TypeScript and opens a new VS Code "Extension Development Host" window with the extension loaded.
    ```bash
    cd apps/vscode-extension
    npm run watch # In a separate terminal
    # Then, in VS Code, press F5 to launch the debugger.
    ```
*   **Compile the code:**
     ```bash
    cd apps/vscode-extension
    npm run compile
    ```
*   **Package the extension:** This creates a `.vsix` file for installation or distribution.
    ```bash
    cd apps/vscode-extension
    npm run package
    ```

### 3.3. Development Conventions

*   The main entry point is `apps/vscode-extension/src/extension.ts`.
*   The architecture uses a factory pattern for its LLM providers (`src/providers/`).
*   The UI panel is implemented using a VS Code Webview (`src/ui/AnalysisPanel.ts`).
*   Configuration is managed via `package.json` `contributes.configuration` section and accessed using the VS Code settings API (`src/utils/configuration.ts`).
*   The extension is well-documented in `apps/vscode-extension/README.md`.
