# Linguride Android

Minimal Android reader shell for the Linguride Rust-first mobile bridge.

## Common Commands

- `cd apps/android && ./gradlew :app:assembleDebug`
- `cd apps/android && ./gradlew testDebugUnitTest`
- `cd apps/android && ./gradlew :app:connectedDebugAndroidTest`
- `cd apps/android && ./gradlew compileDebugAndroidTestKotlin`
- `bash apps/android/scripts/build-rust-android.sh`
- `bash infra_scripts/ci/github/android-validate.sh`
- `cargo test -p mobile-core`

## CI

- GitHub Actions workflow: `.github/workflows/android-ci.yml`
- The validate gate provisions JDK 17, Android SDK 36, NDK `29.0.14206865`, Rust stable, and `cargo-ndk`.
- The workflow executes the same repo-root validation entrypoint used locally: `bash infra_scripts/ci/github/android-validate.sh`

## Environment

- Set `JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home` on macOS/Homebrew.
- Set `ANDROID_HOME` and `ANDROID_SDK_ROOT` to the local Android SDK root.
- For Rust JNI builds, ensure `ANDROID_NDK_HOME` or `ANDROID_NDK_ROOT` points to an installed NDK.
- For local validation with `bash infra_scripts/ci/github/android-validate.sh`, install `cargo-ndk` locally with `cargo install cargo-ndk --locked`.

## Module Overview

- `app/`: Compose activity, navigation host, share intent entry.
- `core-mobile-bridge/`: Kotlin wrapper and JNI loading for `bindings/mobile-core`.
- `data-local/`: Room and DataStore persistence.
- `data-network/`: HTML fetch/extract plus fixed-provider reader networking.
- `feature-import/`: share parsing, import state, manual paste flow.
- `feature-reader/`: reader shell and mode selection.
- `feature-settings/`: local DeepSeek key and CEFR settings.
