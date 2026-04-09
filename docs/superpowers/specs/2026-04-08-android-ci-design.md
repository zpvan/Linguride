# Linguride Android GitHub Actions CI Design

## 1. Context

Linguride currently has a shared GitHub Actions workflow at `.github/workflows/ci.yml` that validates and packages existing repository artifacts such as `chrome-extension` and `macos-app`.

The Android app now exists under `apps/android/` and already has:

- a Gradle multi-module project
- JVM unit tests across multiple modules
- Android instrumentation test sources
- a Rust JNI bridge in `apps/android/core-mobile-bridge`
- a Rust build script at `apps/android/scripts/build-rust-android.sh`

Android CI requirements differ materially from the existing artifacts because Android validation needs Java, Android SDK, Android NDK, Rust Android targets, and `cargo-ndk`.

## 2. Goal

Add a GitHub Actions CI workflow that provides a fast and reliable Android pull request gate.

The gate should verify:

- the Rust mobile core still passes its tests
- Android JNI libraries can still be built and packaged into the app
- the Android app still assembles successfully
- Android JVM unit tests still pass
- Android instrumentation test sources still compile

## 3. Confirmed Scope

This design is based on the following confirmed decisions:

- Android CI will be a dedicated GitHub Actions workflow.
- The first version only targets a fast validation gate.
- The first version does not run emulator-based instrumentation tests.
- The first version does not produce release artifacts such as APK or AAB uploads.
- The design should follow the repository's current CI style where workflows mainly orchestrate and shell scripts hold task logic.

## 4. Non-Goals

This design explicitly does not include:

- Play Store or internal distribution release automation
- APK or AAB signing
- emulator provisioning and `connectedDebugAndroidTest`
- Android-specific lint, detekt, or ktlint gates
- adding Android to the full `infra_scripts` artifact lifecycle of `build`, `test`, `package`, and `smoke`
- refactoring the existing shared CI workflow into reusable workflows

## 5. Approaches Considered

### 5.1 Recommended: Dedicated Workflow With One Validate Job

Create a new workflow such as `.github/workflows/android-ci.yml` with a single `validate` job on `ubuntu-latest`.

Why this is recommended:

- Android setup is substantially different from the existing repository artifacts.
- A dedicated workflow keeps Android-specific environment setup isolated and easy to evolve.
- A single job is the lowest-maintenance way to establish a stable PR gate.
- This structure leaves room to add later jobs for instrumentation tests or packaging without rewriting the workflow.

### 5.2 Alternative: Add Android to the Existing CI Matrix

Extend `.github/workflows/ci.yml` with an `android` matrix entry.

Why this is not recommended now:

- the current workflow is oriented around existing artifact types and shared shell entrypoints
- Android would require many Android-only setup branches inside a supposedly generic matrix
- future Android growth would make the shared workflow harder to understand and maintain

### 5.3 Alternative: Split Android Into Multiple Jobs Immediately

Separate Rust preparation, Gradle validation, and reporting into multiple jobs.

Why this is not recommended now:

- it adds orchestration and artifact-passing complexity before there is a demonstrated need
- repeated environment setup may offset any theoretical parallelism gains
- the repository only needs a reliable first gate, not a heavily optimized pipeline

## 6. Architecture Decision

Use a dedicated Android GitHub Actions workflow with:

- Android-specific trigger filters
- one `validate` job on `ubuntu-latest`
- workflow-level orchestration only
- a thin shell entrypoint at `infra_scripts/ci/github/android-validate.sh`

This follows the repository's existing CI design without prematurely forcing Android into the current artifact registry abstraction.

## 7. Workflow Design

### 7.1 Workflow File

Add a new workflow:

- `.github/workflows/android-ci.yml`

### 7.2 Triggers

The workflow should support:

- `pull_request`
- `push` to `main`
- `push` to `dev_rustify`
- `workflow_dispatch`

The workflow should also use `paths` filters so Android CI only runs when relevant files change.

Recommended paths:

- `apps/android/**`
- `bindings/mobile-core/**`
- `crates/linguride-core/**`
- `crates/linguride-domain/**`
- `Cargo.toml`
- `Cargo.lock`
- `.github/workflows/android-ci.yml`
- `infra_scripts/ci/github/android-validate.sh`

If future Android CI setup is moved into more shared shell helpers, those helper paths should also be added to the trigger filter.

### 7.3 Concurrency

Use workflow concurrency with cancel-in-progress behavior so newer pushes replace older Android validation runs on the same ref.

This should mirror the existing repository CI behavior.

## 8. Validate Job Design

The first version contains one job:

- `validate`

Runtime:

- `ubuntu-latest`

The job is responsible for preparing the toolchain and invoking the Android validation shell script.

### 8.1 Step Order

Recommended step order:

1. Checkout repository
2. Set up JDK 17 with Gradle cache enabled
3. Install Android command line tools components
4. Install a fixed Android NDK version
5. Set up Rust stable with required Android targets
6. Restore Rust cache
7. Install `cargo-ndk`
8. Run `infra_scripts/ci/github/android-validate.sh`

### 8.2 Java and Gradle

Use JDK 17 because the Android project is configured for Java 17 and Kotlin JVM 17.

Gradle caching should be enabled through the Java setup action rather than manually reinventing cache directories in the first version.

### 8.3 Android SDK and Build Tools

Install the minimum required Android components for the current project:

- `platform-tools`
- `platforms;android-36`
- `build-tools;36.0.0`

This matches the project's current `compileSdk` and `targetSdk` configuration.

### 8.4 Android NDK

Install NDK `29.0.14206865` and export:

- `ANDROID_SDK_ROOT`
- `ANDROID_NDK_HOME`
- `ANDROID_NDK_ROOT`

A fixed version is preferred over a floating version because the Android Rust bridge depends on NDK behavior and reproducibility matters more than auto-updating.

NDK `29.0.14206865` is the explicit first-version baseline so CI behavior is deterministic.

### 8.5 Rust Toolchain

Use the stable Rust toolchain and install:

- `aarch64-linux-android`
- `x86_64-linux-android`

These are required because the Android Rust build script emits JNI libraries for `arm64-v8a` and `x86_64`.

### 8.6 cargo-ndk

Install `cargo-ndk` before running Android validation.

The first version should keep this simple and install it directly during the workflow. If future runs show that this is a major bottleneck, it can later be moved into a more explicit repository-local cached tool strategy.

## 9. Validation Script Design

Add a new thin script:

- `infra_scripts/ci/github/android-validate.sh`

Responsibilities:

- verify the commands needed by Android validation are present
- run the Rust mobile core test gate
- run the Android Gradle validation commands

This script should stay thin and repository-root-aware, matching the style of the existing CI adapter scripts.

## 10. Validation Commands

The validation command set should be:

```bash
cargo test -p mobile-core
cd apps/android
./gradlew --no-daemon --stacktrace :app:assembleDebug testDebugUnitTest compileDebugAndroidTestKotlin
```

### 10.1 Why These Commands

`cargo test -p mobile-core`:

- protects the Rust core consumed by Android
- catches regressions before Gradle packaging begins

`:app:assembleDebug`:

- validates Android app assembly
- exercises the Rust JNI packaging path through `core-mobile-bridge`

`testDebugUnitTest`:

- runs Android JVM unit tests through the root Gradle task
- covers tests across Android modules, not only the `app` module

`compileDebugAndroidTestKotlin`:

- validates instrumentation test source compilation
- catches Android test API and Compose test source breakage without requiring an emulator

## 11. Failure Diagnostics

When the validate job fails, the workflow should upload diagnostic outputs if they exist.

Recommended failure-only uploads:

- `apps/android/**/build/reports`
- `apps/android/**/build/test-results`

This improves debugging without slowing successful runs.

The Gradle command should always include `--stacktrace` so failures are actionable in workflow logs.

## 12. Caching Strategy

The first version should use a minimal cache strategy:

- Gradle cache via Java setup action
- Rust cache via `Swatinem/rust-cache`
- no additional custom cache for `cargo-ndk` in the first version

This keeps the workflow understandable while still caching the most expensive and stable layers.

## 13. Why Android Is Not Added to `infra_scripts` Artifact Registry Yet

The repository's current artifact abstraction expects a fuller lifecycle with explicit `build`, `test`, `package`, and `smoke` phases.

Android CI currently only needs a validation gate. Forcing Android into the registry immediately would create one of two bad outcomes:

- artificial empty phase scripts only to satisfy the abstraction
- premature package and smoke semantics before they are actually needed

Using a dedicated Android validation script preserves the repository's workflow style while avoiding an abstraction mismatch.

If Android later gains stable packaging and smoke requirements, it can be promoted into the artifact registry at that time.

## 14. Risks and Mitigations

### 14.1 Risk: Android Tooling Drift

Android SDK or NDK versions may drift from project expectations.

Mitigation:

- pin the SDK components and NDK version in the workflow
- keep the workflow aligned with `compileSdk`, `targetSdk`, and the Rust build script targets

### 14.2 Risk: Partial Test Coverage

The first version does not execute instrumentation tests on a device or emulator.

Mitigation:

- compile `androidTest` sources as part of validation
- reserve a future dedicated job for emulator-backed tests when the gate needs stronger coverage

### 14.3 Risk: Slow Cold Starts

Android SDK, Rust, and NDK provisioning may make early workflow runs slower.

Mitigation:

- use built-in Gradle and Rust caches first
- only add more cache complexity after actual bottlenecks are observed

## 15. Future Extensions

This design intentionally leaves room for later additions:

- add a second job for emulator-backed `connectedDebugAndroidTest`
- add packaging jobs for debug or release APK artifacts
- add Android lint or static analysis after the repository establishes a green baseline
- promote Android into the shared artifact lifecycle only when package and smoke phases become real requirements

## 16. Implementation Outline

The implementation implied by this design is small and isolated:

1. Add `.github/workflows/android-ci.yml`
2. Add `infra_scripts/ci/github/android-validate.sh`
3. Ensure workflow environment variables expose Android SDK and NDK paths to Gradle and the Rust build script
4. Verify the workflow and script remain consistent with current Android build settings

## 17. Acceptance Criteria

This design is complete when:

- Android changes trigger a dedicated GitHub Actions workflow
- unrelated repository changes do not trigger Android CI
- the workflow provisions JDK, Android SDK, Android NDK, Rust, and `cargo-ndk`
- the workflow runs Rust mobile-core tests
- the workflow runs Android debug assembly
- the workflow runs Android JVM unit tests
- the workflow compiles Android instrumentation test sources
- workflow failures expose useful Gradle diagnostics
