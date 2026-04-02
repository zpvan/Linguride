# Infra Scripts

`infra_scripts/` 提供面向产物的构建、测试、打包和 CI 适配脚本。

## 目录结构

- `bin/`：公开入口脚本。
- `lib/`：公共函数、路径解析、日志和环境检查。
- `artifacts/`：按产物拆分的脚本实现。
- `ci/`：GitHub 和 Jenkins 的薄适配层。
- `out/`：统一的打包产物输出目录。

## 当前支持的产物

- `chrome-extension`
- `macos-app`
- `vscode-extension`

## 入口命令

- `infra_scripts/bin/doctor.sh [artifact]`
- `infra_scripts/bin/bootstrap.sh [artifact]`
- `infra_scripts/bin/list-artifacts.sh [--json]`
- `infra_scripts/bin/build-artifact.sh <artifact>`
- `infra_scripts/bin/test-artifact.sh <artifact>`
- `infra_scripts/bin/package-artifact.sh <artifact>`
- `infra_scripts/bin/smoke-artifact.sh <artifact>`
- `infra_scripts/bin/clean.sh <artifact|all>`

## GitHub Actions

- 入口 workflow 为 `.github/workflows/ci.yml`
- `pull_request`：运行 `chrome-extension` 与 `macos-app` 的 test gate
- `push` 到 `main` / `dev_rustify`，以及 `workflow_dispatch`：在 test gate 通过后继续打包并上传 `infra_scripts/out/<artifact>/`
- workflow 只负责编排；实际逻辑仍通过 `infra_scripts/ci/github/*.sh` 转发到 artifact 脚本

## CI 安装约定

- 本地默认使用 `npm install`
- 当 `CI=true` 且根目录存在 `package-lock.json` 时，`bootstrap.sh` 自动切换到 `npm ci`
- 当 `bootstrap.sh` 带 `artifact` 参数执行时，只安装该产物需要的 workspaces；不带参数时仍执行全仓安装
- npm cache 统一落到 `infra_scripts/out/.npm-cache`，避免依赖宿主机的全局 `~/.npm`
- `chrome-extension` 与 `macos-app` 的 CI 会自动补齐 Rust/WASM 前置依赖：`wasm32-unknown-unknown` target，以及安装到 `./.tools/bin/` 的 `wasm-bindgen` / `wasm-bindgen-test-runner`
- 所有通过 `run_repo_cmd` 触发的仓库命令都会自动把 `./.tools/bin/` 置于 `PATH` 前缀，优先使用 repo-local 工具而不是宿主机全局安装

## 设计约束

- 所有脚本都从仓库根解析路径，不依赖当前 shell 目录。
- 所有产物脚本都只处理自己的产物逻辑，不跨目录混写。
- `ci/` 目录只做 CI 适配，不复制产物逻辑。
- 打包产物统一写入 `infra_scripts/out/<artifact>/`。

## 当前测试门禁定义

- `chrome-extension`：`typecheck + lint + build`，外加可选的 `npm test --if-present`
- `macos-app`：`build:desktop + test:rust + test:web-core:wasm`
- `vscode-extension`：`compile`，外加可选 extension-host tests

`vscode-extension` 当前没有可运行的 `src/test/runTest` 入口，而且现有 lint 规则也未清债，因此默认 test gate 不把 `lint` 和 `npm run test:vscode` 作为强制通过项。等该工程补齐绿色基线后，再把它们提升为强制门禁。

## 本地对等验证

- `bash infra_scripts/ci/github/test.sh chrome-extension`
- `bash infra_scripts/ci/github/test.sh macos-app`
- `bash infra_scripts/ci/github/package.sh chrome-extension && bash infra_scripts/ci/github/smoke.sh chrome-extension`
- `bash infra_scripts/ci/github/package.sh macos-app && bash infra_scripts/ci/github/smoke.sh macos-app`
