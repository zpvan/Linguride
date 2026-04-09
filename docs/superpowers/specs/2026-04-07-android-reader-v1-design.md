# Linguride Android Reader V1 Design

## 1. Context

Linguride currently has:

- `apps/browser-extension`: Chrome extension shell for reading, tutor, corpus, provider configuration, and browser-specific runtime integration.
- `apps/desktop`: Tauri desktop shell as the first Rust consumer.
- `crates/linguride-domain`: cross-platform DTOs and stable contracts.
- `crates/linguride-core`: shared business core for capture, workspace, reader, and related flows.

The repository architecture is already defined as `Rust-first core + platform shells`. There is no Android project yet.

The browser extension is the closest feature baseline, but its main reading workflow depends on browser-only primitives such as `chrome.*`, content scripts, service workers, and DOM injection. That structure cannot be copied directly to Android.

## 2. Goal

Build an Android V1 app that matches the browser extension's reading use case for:

- importing a public article from Android system share
- converting it into a clean in-app reader view
- switching between `Translate`, `Paraphrase`, and `Mixed` reading modes
- analyzing article difficulty
- persisting local reading state and generated results

## 3. Confirmed Scope

This design is based on the following confirmed decisions:

- Android first release only targets `Reader + Translate / Paraphrase / Mixed + Difficulty`.
- Entry flow is `share from system browser into Linguride`.
- Reader presentation uses a clean app reader view, not original webpage layout preservation.
- AI configuration is simplified for V1: one fixed provider and fixed prompts.
- The fixed V1 provider is `DeepSeek`, configured by API key.
- Supported content sources are:
  - public article URL
  - manual pasted article text as fallback
- Data is local-only for V1. No account system and no cross-device sync.

## 4. Non-Goals

Android V1 explicitly does not include:

- Tutor flows
- Corpus listening flows
- ASR or TTS
- OpenAI OAuth
- multi-provider configuration UI
- prompt editing UI
- login-required pages, paywalled pages, or cookie-bound page extraction
- full original page layout preservation
- cross-device sync

## 5. Product Shape

The main user journey is:

1. User opens an article in a browser.
2. User chooses Android system share and sends the URL to Linguride.
3. Linguride fetches the article and extracts a clean readable body.
4. If extraction fails, Linguride offers manual paste fallback.
5. The article opens in a clean reader view.
6. User switches between `Translate`, `Paraphrase`, and `Mixed`.
7. User opens a difficulty bottom sheet without leaving the reader.
8. Linguride stores the article, cached mode outputs, and last reading position locally.

## 6. Architecture Decision

Use `Kotlin + Jetpack Compose shell + Rust core bridge`.

V1 keeps Android-specific runtime concerns in Kotlin, while moving stable reading semantics toward Rust.

### 6.1 Why This Approach

This approach matches the repository direction without blocking V1 on a full Rust migration.

- Pure Kotlin would be fastest initially, but would create a second independent core for capture, reader, difficulty, and state semantics.
- Reusing the browser extension shell directly would provide low practical reuse because the extension is tightly coupled to Chrome runtime APIs and in-page DOM augmentation.
- A hybrid Android shell allows fast delivery now while preserving a path to move shared reading logic into Rust over time.

### 6.2 Core Constraint

Current Rust reader support is partial:

- `crates/linguride-core/src/reader/mod.rs` already handles text normalization, block splitting, summary metrics, and difficulty estimation.
- The actual `Translate / Paraphrase / Mixed` rendering logic is still implemented in the browser extension TypeScript shell.
- Rust currently renders placeholder text for those modes.

Because of that, Android V1 should not wait for all reader enhancement logic to migrate into Rust.

## 7. High-Level System Design

Android V1 uses a single-direction flow:

`System Share -> Import Coordinator -> Fetch / Extract -> Local Persistence -> Rust Analysis -> Kotlin AI Rendering -> Reader UI`

Responsibilities are split as follows.

### 7.1 Android Shell

Kotlin + Compose is responsible for:

- receiving Android share intents
- navigating between import, fallback, reader, and recent items
- rendering the clean reader UI
- invoking article fetch and extraction
- invoking the fixed AI provider
- caching per-mode rendering results
- persisting local article state

### 7.2 Rust Core

Rust is responsible for stable cross-platform reading semantics:

- capture creation semantics
- text normalization
- block splitting
- difficulty summary
- difficulty tiering and DTO output

### 7.3 V1 Reader Enhancement Engine

For V1 only, `Translate / Paraphrase / Mixed` generation remains in Kotlin.

This engine:

- reads the normalized article blocks
- sends batch requests to the fixed provider
- maps responses back to paragraph blocks
- persists results in local cache

### 7.4 Future Evolution

V2 should migrate reader enhancement orchestration from Android and browser shells into Rust so both platforms share one Reader core instead of duplicating AI rendering logic.

## 8. Repository Placement

Recommended additions:

- `apps/android/app`
- `apps/android/feature-import`
- `apps/android/feature-reader`
- `apps/android/feature-settings`
- `apps/android/data-local`
- `apps/android/data-network`
- `apps/android/core-mobile-bridge`
- `bindings/mobile-core`

Existing shared locations remain:

- `crates/linguride-domain`
- `crates/linguride-core`

## 9. Module Responsibilities

### 9.1 `apps/android/app`

Owns:

- Android entry points
- `ACTION_SEND` share intent handling
- navigation host
- top-level dependency graph

### 9.2 `apps/android/feature-import`

Owns:

- URL import flow
- loading states
- extraction failure handling
- manual paste fallback flow

### 9.3 `apps/android/feature-reader`

Owns:

- reader screen
- reading mode switcher
- difficulty bottom sheet
- article-level retry actions
- last read position restoration

### 9.4 `apps/android/feature-settings`

Owns V1 minimal settings only:

- fixed provider API key
- user CEFR level

### 9.5 `apps/android/data-local`

Owns:

- article persistence
- rendered mode cache persistence
- reading position persistence
- recent article index

### 9.6 `apps/android/data-network`

Owns:

- article HTTP fetch
- readability-style extraction
- AI provider HTTP calls

### 9.7 `apps/android/core-mobile-bridge`

Owns:

- Kotlin-facing bridge to Rust mobile bindings
- serialization and DTO mapping
- shielding UI and feature modules from low-level binding details

### 9.8 `bindings/mobile-core`

Owns:

- Android-consumable Rust export surface
- stable binding functions for capture ingestion and reader analysis

## 10. Key Runtime Flows

### 10.1 Share Import Flow

1. Android receives `ACTION_SEND`.
2. `ShareReceiver` validates whether the payload is a public URL or plain text.
3. `ImportCoordinator` routes the input:
   - URL -> fetch and extract
   - plain text -> direct manual article import
4. A cleaned article record is written to local storage.
5. Cleaned text is sent through the Rust bridge for capture and difficulty analysis.
6. Reader screen opens with original content immediately visible.

### 10.2 Reader Mode Flow

1. Reader screen loads stored paragraphs and Rust analysis output.
2. User selects one of:
   - `Translate`
   - `Paraphrase`
   - `Mixed`
3. Reader checks local cache by `articleId + mode + paragraphHash`.
4. Cached blocks render immediately when available.
5. Missing blocks are requested from the fixed provider in batches.
6. Results are stored and progressively rendered under original paragraphs.

### 10.3 Difficulty Flow

1. Reader opens a bottom sheet from the current article context.
2. The sheet shows:
   - difficulty tier
   - CEFR estimate
   - score
   - reading time
   - summary highlights
   - suggestions
3. Difficulty does not require leaving the reader page.

## 11. UI Structure

Android V1 consists of four main screens or surfaces.

### 11.1 Import Loading Surface

Shown immediately after share-in.

States:

- importing URL
- extracting content
- analysis in progress
- failure with fallback actions

### 11.2 Manual Paste Fallback Surface

Shown when fetch or extraction fails, or when the user shares plain text directly.

Actions:

- paste title optionally
- paste article body
- continue into reader

### 11.3 Reader Surface

Main screen.

Contains:

- top app bar
- article title
- source link action
- mode switcher
- clean paragraph list
- rendered support blocks under each paragraph
- retry affordance for failed paragraph batches

Reader always prioritizes displaying original text first. Mode output is layered on progressively.

### 11.4 Difficulty Bottom Sheet

Attached to the reader surface.

Contains:

- difficulty label
- CEFR estimate
- score
- estimated reading time
- highlights
- suggested next actions

## 12. Storage Design

Android V1 is local-first and local-only.

Store the following:

- imported article metadata
- cleaned article body
- paragraph list
- source URL
- import timestamp
- last read position
- difficulty result
- per-mode rendered block cache

Recommended cache key:

`articleId + mode + paragraphHash`

This ensures:

- repeat opens are fast
- mode switches can reuse prior results
- edited or re-extracted content invalidates stale paragraph outputs automatically

## 13. Error Handling And Degradation

The error strategy is `continue reading whenever possible`.

### 13.1 Invalid Share Payload

If the share payload is neither a valid URL nor usable text:

- stop at import
- show a clear retry instruction

### 13.2 Fetch Failure

If article fetch fails due to timeout, network failure, or target site rejection:

- show retry
- offer manual paste fallback

### 13.3 Extraction Failure

If extraction cannot produce a stable article body:

- explain that article extraction was not reliable
- route user to manual paste fallback

### 13.4 Rust Analysis Failure

If capture creation or difficulty analysis fails:

- preserve the imported article locally
- continue showing the clean reader
- temporarily disable or hide difficulty details

### 13.5 AI Rendering Failure

If any reader mode fails:

- keep original text readable
- keep successful cached results from other modes
- allow retry for the failed mode or batch

### 13.6 Offline State

If the article is already imported:

- original content remains readable
- cached mode outputs remain readable
- only new AI requests are disabled

## 14. Performance Strategy

The reader must feel usable before all AI work completes.

Rules:

- render original text first
- request mode outputs in batches
- progressively append rendered results
- avoid blocking initial reader display on whole-article completion
- reuse cache aggressively

This is especially important for long-form articles.

## 15. Acceptance Criteria

Android V1 is considered complete when all of the following are true:

- user can share a public article URL from an Android browser into Linguride
- Linguride can fetch and extract a clean article body for supported public pages
- if extraction fails, user can continue with manual pasted text
- user can read the article in a clean in-app reader
- user can switch between `Translate`, `Paraphrase`, and `Mixed`
- difficulty can be viewed as a bottom sheet from the reader
- recent articles, last reading position, and generated mode outputs are stored locally

## 16. Verification Strategy

Testing should be split into three layers.

### 16.1 Rust Tests

Cover:

- capture semantics
- block splitting
- text normalization
- difficulty metrics and tier boundaries
- DTO contract stability

### 16.2 Android JVM Tests

Cover:

- import coordinator routing
- extraction result mapping
- cache key invalidation
- reader state transitions
- error and fallback state handling

### 16.3 Android Instrumentation Tests

Cover:

- share intent ingestion
- failed import fallback into manual paste
- reader mode switching
- difficulty sheet display
- recent article reopening
- reading position restoration

## 17. Migration Guidance

Android V1 should not attempt to port the browser extension runtime model.

Specifically:

- do not reproduce content-script style page injection
- do not use WebView as the main reading architecture
- do not introduce a second long-term business core in Kotlin for capture and difficulty semantics

Instead:

- keep Android runtime concerns in Kotlin
- keep stable cross-platform contracts in Rust
- defer full AI reader orchestration migration into Rust to a later phase

## 18. Summary

Android Reader V1 is a focused, local-first mobile product:

- share public article into app
- convert it to a clean reader
- augment reading with three reading modes
- show article difficulty in context
- cache everything locally

This design intentionally narrows scope so the team can ship a usable Android reading workflow without violating the repository's Rust-first direction.
