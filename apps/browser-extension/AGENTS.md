# Repository Guidelines

This extension now lives under `apps/browser-extension` in the repository.

## Project Structure & Module Organization
Core extension code lives in `src/`, organized by runtime surface:

- `background/`: service worker message routing, provider selection, OpenAI OAuth, model catalog sync, config and tab state
- `content/`: page extraction, translation/paraphrase/mixed-mode injection, caching, viewport handling, selection toolbar
- `popup/`: main entry UI for reading modes, difficulty analysis, settings, and links into tutor/corpus pages
- `tutor/`: standalone learning page for translation, sentence analysis, shadowing, pronunciation, and speaking practice
- `corpus/`: standalone corpus listening workflow with segmentation, dictation, and feedback
- `permissions/`: permission helper pages such as microphone authorization

Shared code is primarily in:

- `providers/`: AI provider implementations and adapters
- `shared/`: cross-surface helpers such as hybrid TTS playback
- `constants/`: default prompts and static configuration
- `types/`: extension config, message contracts, result models, and feature types

Other important directories:

- `public/icons/`: extension icons and static assets
- `scripts/`: install helpers and asset generation scripts
- `docs/`: UI and design guidance
- `feat-docs/`: feature design notes and implementation references

Treat `dist/` as build output and `release/` as packaged artifacts; do not edit either directly.

## Build, Test, and Development Commands

Install dependencies from the repository root with `npm install`. Then use either the root workspace commands or run scripts directly inside `apps/browser-extension`.

When you need to update and commit `package-lock.json`, regenerate it from the repository root with a full `npm install`. Do not commit a lockfile produced by `npm install --workspace ...`, because npm can omit Rollup's platform-specific optional packages.

- `npm run dev:browser-extension`: start the Vite development workflow from the repo root
- `npm run typecheck:browser-extension`: run the TypeScript no-emit check from the repo root
- `npm run build:browser-extension`: run `tsc` and bundle into `dist/` from the repo root
- `npm run lint:browser-extension`: run ESLint from the repo root
- `cd apps/browser-extension && npm run install:mac`: build, open `chrome://extensions/`, and copy the `dist` path

Optional Bun flow is supported:

- `bun install`
- `bun run build`

## Coding Style & Naming Conventions
TypeScript is configured with strict checks including `strict`, `noUnusedLocals`, and `noUnusedParameters`.

Match the existing code style:

- 2-space indentation
- semicolons
- double quotes

Naming conventions:

- `camelCase` for variables, functions, and most file names such as `translationInjector.ts`
- `PascalCase` for classes, interfaces, and types such as `DeepSeekProvider` and `ITranslateProvider`
- keep feature-specific logic inside its runtime folder and shared contracts in `src/types`

No lint or formatter command is enforced in this repo. Keep edits consistent with neighboring files.

## Testing Guidelines
There is no automated `npm test` script yet. Minimum validation depends on the surface you change.

Always run:

1. `npm run build`

Then manually verify the affected flows in Chrome using unpacked `dist/`:

1. Popup and settings changes:
   Check provider selection, OpenAI auth mode, connection testing, Prompt edits, and any ASR/TTS settings you touched.
2. Content script changes:
   Verify translation, paraphrase, mixed mode, page extraction, and any selection-toolbar behavior you touched.
3. Tutor changes:
   Verify the relevant mode such as translation, definition, sentence analysis, shadowing, pronunciation, microphone flow, or TTS playback.
4. Corpus changes:
   Verify segmentation, playback, answer submission, analysis, retry, skip, and completion summary.
5. Permissions changes:
   Verify the standalone permission page and browser permission prompt behavior.

If you add automated tests, place `*.test.ts` under `src/**` and add the script to `package.json`.

## Commit & Pull Request Guidelines
Follow the existing Conventional Commit style:

- `feat(scope): ...`
- `fix(scope): ...`
- `style(scope): ...`
- `refactor(scope): ...`

Common scopes include `browser-extension`, `popup`, `tutor`, and `corpus`. Keep commits single-purpose.

PRs should include:

- a concise summary
- linked task or issue
- screenshots or GIFs for visual changes
- manual verification notes listing the flows you exercised

## Security & Configuration Tips

- Never commit real API keys, OAuth tokens, ASR secrets, or TTS credentials.
- Treat OpenAI OAuth callback data and stored credentials as sensitive material.
- Review `src/manifest.json` carefully for any permission, host permission, or web-accessible-resource changes.
- Regenerate build output from source instead of patching `dist/`.
- Be careful when changing provider defaults, auth flows, microphone behavior, or cloud speech-service priorities because they affect multiple runtime surfaces.

## Documentation Maintenance

- When setup steps, user-facing behavior, provider options, or verification flows change, update `README.md` in the same change.
- When feature behavior or UI contracts change materially, sync the relevant documents under `docs/` or `feat-docs/` if they would otherwise become misleading.
- Keep naming consistent with the current product spelling used by the extension: `Lingride`.
