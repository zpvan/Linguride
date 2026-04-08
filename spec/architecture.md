# Linguride 工程架构

## 1. 文档目标

本文档描述当前仓库已经落地的工程边界，以及正在执行中的 Rust-first 迁移方向。

- 以当前仓库目录、workspace 配置和可构建产物为准。
- 产品功能范围由 `spec/spec.md` 描述；本文档只约束工程结构和依赖方向。
- 当历史文档仍写有 `Lingride`、`Lingrid` 或 “browser stays TypeScript-only” 时，以本文档和当前代码为准。

## 2. 当前架构结论

Linguride 当前采用 `Rust-first core + platform shells`。

- `crates/linguride-domain`：跨端 DTO、错误码、配置结构、capture/session 契约。
- `crates/linguride-core`：Reader、Tutor、Corpus、OAuth、capture、session、provider 等业务核心。
- `bindings/mobile-core`：Android 侧 JNI 绑定入口，服务 `apps/android`。
- `bindings/web-core`：浏览器侧 WASM 绑定入口，服务 `apps/browser-extension`。
- `apps/android`：Android 平台壳，负责 Activity、Compose UI、share intent、Room/DataStore 和 JNI bridge 接入。
- `apps/browser-extension`：Chrome Extension 平台壳，负责生命周期、DOM 注入、扩展 UI、权限和浏览器专属 API。
- `apps/desktop`：Tauri 桌面壳，负责窗口、命令桥、本地存储、桌面 UI 和系统能力接入。
- `packages/*`：仍保留历史纯 TS 包，但已经从“核心业务承载层”降级为迁移期兼容层和 UI/工具层。

当前 workspace：

- npm workspace：`apps/*` + `packages/*`
- Cargo workspace：`apps/desktop/src-tauri` + `crates/linguride-domain` + `crates/linguride-core` + `bindings/mobile-core` + `bindings/web-core`

## 3. 核心依赖方向

Rust 依赖方向固定为：

`linguride-domain <- linguride-core <- { bindings/mobile-core, bindings/web-core, apps/desktop/src-tauri }`

工程约束：

- `linguride-domain` 不能依赖 Tauri、WASM、HTTP client、SQLite、文件系统、Chrome API。
- `linguride-core` 不能依赖 `tauri`、`wasm-bindgen`、DOM、`chrome.*` 或平台存储实现；只能通过 ports 接外部能力。
- `bindings/mobile-core` 只能把 Android/JNI host 能力桥接进 Rust core，不能新增业务分支。
- `bindings/web-core` 只能把浏览器 host 能力桥接进 Rust core，不能新增业务分支。
- `apps/android` 只能做 Activity、Compose、Room/DataStore、网络接线和 JNI adapter，不能自己复制 Reader/Tutor/Corpus 的核心规则。
- `apps/desktop/src-tauri` 只能做 Tauri commands 和 adapter，不能自己拼 prompt、解析业务响应或实现 Reader/Tutor/Corpus 规则。
- 平台壳都不能绕过 Rust core 复制一套业务逻辑。

## 4. Monorepo 目录职责

### 4.1 根目录

- `apps/`：平台应用层。
- `bindings/`：Rust core 的绑定层。
- `crates/`：Rust 共享核心。
- `packages/`：历史 TS 共享包和迁移期兼容层。
- `spec/`：产品规格和工程架构文档。
- `scripts/`：根级构建与辅助脚本。
- `Cargo.toml`：Rust workspace 入口。
- `package.json`：npm workspace 和统一脚本入口。

### 4.2 `crates/linguride-domain/`

只放跨端稳定契约：

- `config.rs`：配置结构和枚举。
- `errors.rs`：统一错误码和错误结构。
- `reader.rs`：Reader 输出 DTO。
- `tutor.rs`：Tutor DTO。
- `corpus.rs`：Corpus DTO。
- `oauth.rs`：OAuth 状态和凭据结构。
- `capture.rs`：handoff envelope 与 capture record。
- `session.rs`：会话历史结构。

### 4.3 `crates/linguride-core/`

只放业务核心与 ports：

- `config/`：配置默认值和归一化逻辑。
- `capture/`：handoff envelope 创建、TTL、hash、截断、ingest。
- `reader/`：Reader 模式执行与难度分析。
- `tutor/`：Tutor 用例。
- `corpus/`：Corpus 用例。
- `oauth/`：OAuth 状态机和流程核心。
- `provider/`：provider 请求模型、stream/http 解析和 transport port。
- `session/`：capture 对应的会话生成与 reducer。
- `ports/`：config store、capture store、session store、credential store、clock、id generator。
- `support/`：纯工具函数。

### 4.4 `bindings/web-core/`

浏览器 WASM 绑定层：

- Rust crate 编译为 `wasm32-unknown-unknown`。
- 通过 `wasm-bindgen` 导出给浏览器调用的稳定函数。
- 生成产物进入 `apps/browser-extension/public/web-core/`，由扩展在运行时动态加载。

### 4.5 `apps/browser-extension/`

浏览器扩展平台壳：

- `src/background/`：service worker、Chrome 生命周期、消息路由、OAuth 浏览器回调承接。
- `src/content/`：页面文本提取、DOM 注入、selection toolbar、视口联动。
- `src/popup/`：扩展 popup UI。
- `src/tutor/`、`src/corpus/`：浏览器端专项交互 UI。
- `src/shared/`：扩展内共享工具和 Rust WASM host。
- `public/web-core/`：`bindings/web-core` 生成的 JS/WASM 产物目录。

当前状态：

- 浏览器扩展仍保留大量历史 TS 业务代码。
- 新增的桌面 handoff 与 Rust host 已经接入 popup。
- Reader/Tutor/Corpus 向 Rust 收口仍在迁移中。

### 4.6 `apps/desktop/`

桌面端平台壳：

- `src/`：React 桌面 UI。
- `src/lib/`：Tauri invoke 封装。
- `src/types/`：桌面前端消费的 DTO。
- `src-tauri/src/commands/`：桌面命令入口。
- `src-tauri/src/adapters/`：capture store、credential store 等 adapter。
- `src-tauri/src/state.rs`：桌面侧共享状态模型。

当前状态：

- 已落地最小 `Inbox/Reader` 链路。
- 手动导入、handoff ingest、Reader 执行、配置保存已经走 Rust core。
- SQLite、Stronghold、deep link plugin、speech bridge 仍属于后续实现项。

### 4.7 `apps/android/`

Android 端平台壳：

- `app/`：Application、Activity、Compose host、share intent handling 和导航入口。
- `core-mobile-bridge/`：Kotlin JNI wrapper，负责加载 `bindings/mobile-core` 产物。
- `data-local/`：Room 和 DataStore 持久化。
- `data-network/`：URL fetch / clean reader extract 与固定 provider 网络调用。
- `feature-import/`、`feature-reader/`、`feature-settings/`：Android V1 的 UI 与状态模块。
- `scripts/build-rust-android.sh`：构建 `bindings/mobile-core` 并复制 JNI 产物到 `core-mobile-bridge`。

当前状态：

- 已落地最小 share-import、manual paste、reader shell 和 settings 流程。
- Android 仍是 V1 骨架，尚未接入完整账号体系、同步和 richer reader orchestration。

### 4.8 `bindings/mobile-core/`

Android JNI 绑定层：

- Rust crate 编译为 Android `cdylib`，通过 JNI 暴露给 Kotlin 层调用。
- 提供面向移动端的稳定 JSON API，封装 `linguride-core` 的 capture 与 reader 分析。
- 产物由 `apps/android/scripts/build-rust-android.sh` 输出到 `apps/android/core-mobile-bridge/build/generated/jniLibs/`。

### 4.9 `packages/`

`packages/*` 保持纯 TypeScript，但不再是跨端业务核心的目标归宿。

- `packages/contracts-ts`：当前仍保留历史 TS 契约；后续会逐步被 Rust DTO 生成结果接管。
- `packages/prompt-kits`：历史 Prompt 工具。
- `packages/text-assistant-core`：历史文本助手逻辑。

约束：

- `packages/*` 不允许依赖 `chrome.*`、Tauri API、VS Code API。
- 新的跨端业务规则优先进入 Rust core，而不是继续沉淀到 `packages/*`。

## 5. 构建链与主要产物

### 5.1 Rust

- `cargo check --workspace`
- `cargo test -p linguride-core`
- `cargo test -p mobile-core`
- `cargo check -p web-core --target wasm32-unknown-unknown`

### 5.2 Browser Extension

- `npm run build:web-core-wasm`
  - 编译 `bindings/web-core`
  - 通过仓库内 `./.tools/bin/wasm-bindgen` 生成 JS/WASM
  - 输出到 `apps/browser-extension/public/web-core/`
- `npm run typecheck:browser-extension`
- `npm run build:browser-extension`

### 5.3 Desktop

- `npm run build:desktop`
- `npm run tauri:dev:desktop`
- `npm run tauri:build:desktop`

### 5.4 Android

- `bash apps/android/scripts/build-rust-android.sh`
- `cd apps/android && ./gradlew :app:assembleDebug`
- `cd apps/android && ./gradlew :app:testDebugUnitTest`
- `cd apps/android && ./gradlew :app:connectedDebugAndroidTest`

### 5.5 主要产物路径

- `target/`：Rust workspace 编译产物。
- `apps/android/core-mobile-bridge/build/generated/jniLibs/`：Android JNI 共享库输出目录。
- `apps/android/app/build/outputs/`：Android APK 与测试 APK 产物。
- `apps/browser-extension/public/web-core/`：浏览器侧 Rust WASM 绑定生成目录。
- `apps/browser-extension/dist/`：Chrome Extension 构建产物。
- `apps/desktop/dist/`：桌面前端 bundle。
- `apps/desktop/src-tauri/target/`：Tauri 桌面产物。

## 6. 当前非目标与迁移状态

- 当前没有 iOS 工程。
- `apps/vscode-extension` 未纳入本轮 Rust-first 实施范围。
- 桌面端尚未落地 SQLite、Stronghold、deep link plugin、speech bridge 的正式实现。
- Android 端尚未落地账号同步、正式 release pipeline 和更完整的 reader orchestration。
- 浏览器扩展尚未完成全部 Reader/Tutor/Corpus 逻辑迁入 Rust；目前处于“老 TS 逻辑继续可用，新 Rust 接口开始接入”的迁移期。
- `packages/contracts-ts` 还没有完全切到 Rust 自动生成，这是后续迁移项，不代表 Rust-first 方向回退。

## 7. 维护规则

- 新增跨端业务逻辑时，优先进入 `crates/linguride-core`。
- 新增跨端稳定 DTO 时，优先进入 `crates/linguride-domain`。
- 新增 Android/JNI 桥接能力时，优先进入 `bindings/mobile-core` 或 `apps/android/core-mobile-bridge`，不要把业务规则留在 Kotlin 层。
- 新增浏览器专属能力时，放在 `apps/browser-extension`，不要反向污染 Rust core。
- 新增桌面专属能力时，放在 `apps/desktop/src-tauri/src/adapters` 或前端 `src/`，不要在 command 层复制业务规则。
- 修改 workspace 成员、核心依赖方向或绑定构建链时，必须同步更新本文档。
