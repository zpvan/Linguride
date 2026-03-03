# Repository Guidelines

## Project Structure & Module Organization
Core extension code is in `src/`, grouped by runtime surface: `background/` (service worker + tab/config state), `content/` (page extraction/injection), `popup/` (main UI), `tutor/`, `corpus/`, and `permissions/` (extra HTML entry points). Shared logic lives in `providers/`, `constants/`, and `types/`. Static assets are under `public/icons/`. Automation scripts are in `scripts/`. Treat `dist/` as build output and `release/` as packaged artifacts; do not edit either directly.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start Vite dev workflow for the extension.
- `npm run build`: run `tsc` then bundle to `dist/`.
- `npm run preview`: preview the built bundle.
- `npm run install:mac`: build, open `chrome://extensions/`, and copy the `dist` path.

Optional Bun flow is supported in scripts (`bun install`, `bun run build`).

## Coding Style & Naming Conventions
TypeScript is configured with strict checks (`strict`, `noUnusedLocals`, `noUnusedParameters`). Match existing code style: 2-space indentation, semicolons, and double quotes. Use:
- `camelCase` for variables/functions and most file names (for example, `translationInjector.ts`).
- `PascalCase` for classes/types/interfaces (for example, `DeepSeekProvider`, `ITranslateProvider`).
- Clear feature boundaries: keep feature logic in its folder, shared contracts in `src/types`.

No lint/format script is currently enforced, so consistency with neighboring files is expected.

## Testing Guidelines
There is no automated test framework or `npm test` script yet. Minimum PR validation:
1. Run `npm run build` with zero TypeScript errors.
2. Load unpacked `dist/` in Chrome.
3. Manually verify changed flows (popup controls, content translation injection, and any touched tutor/corpus pages).

If you add automated tests, place `*.test.ts` files under `src/**` and add the corresponding script in `package.json`.

## Commit & Pull Request Guidelines
Follow the observed Conventional Commit style: `feat(scope): ...`, `fix(scope): ...`, `style(scope): ...`, `refactor(scope): ...` (scopes commonly include `chrome-extension`, `popup`, `tutor`). Keep commits single-purpose.

PRs should include a concise description, linked issue/task, UI screenshots or GIFs for visual changes, and manual verification notes.

## Security & Configuration Tips
Never commit real API keys or ASR credentials. Review permission-related edits carefully in `src/manifest.json`. Regenerate build output from source instead of patching `dist/`.
