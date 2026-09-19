# Linguride 工程架构

## 1. 文档目标

本文档描述当前仓库**实际落地**的工程结构与依赖方向，以可构建产物为准。产品愿景见 `docs/Linguride-PRD.md`（其中多平台规划未实施）。

> 2026-09 起，仓库仅维护 Chrome 浏览器插件一个产物；Android / Desktop / VSCode 产物已移除（`bdbee63`）。

## 2. 当前架构结论

`Rust core（WASM）+ Chrome Extension 平台壳`：

- `crates/linguride-domain`：跨端 DTO、错误码、配置结构、capture/session 契约。
- `crates/linguride-core`：Reader、Tutor、Corpus、OAuth、capture、session、provider 等业务核心。
- `bindings/web-core`：Rust → WASM 绑定（wasm-bindgen），供扩展使用。
- `packages/contracts-ts`：共享 TS 契约（DTO / 配置类型），扩展的直接依赖。
- `apps/browser-extension`：唯一的平台壳与产物，负责生命周期、DOM 注入、扩展 UI、权限和浏览器专属 API。

Workspace：

- npm workspace：`apps/*` + `packages/*`（实际各剩一个）
- Cargo workspace：`crates/linguride-domain` + `crates/linguride-core` + `bindings/web-core`

## 3. 核心依赖方向

```
apps/browser-extension  →  packages/contracts-ts（TS 类型契约）
                      ↘  bindings/web-core（WASM 产物，构建期生成）
bindings/web-core       →  crates/linguride-core → crates/linguride-domain
```

约束：

- `linguride-domain` 不依赖 WASM、HTTP client、Chrome API 等任何平台能力。
- 扩展侧平台专属逻辑（DOM、chrome.* API、音频播放）不下沉到 Rust core。

## 4. 浏览器插件内部结构（`apps/browser-extension/src/`）

- `manifest.json`：MV3 清单（side_panel + content_scripts + offscreen）
- `sidepanel/`：侧边栏（学习控制中心 + 设置视图），点击工具栏图标在浏览器右侧展开
- `background/service-worker.ts`：消息路由、AI API 调用、配置管理（chrome.storage.local）、TTS 合成任务、ASR 鉴权（豆包走 DNR 会话规则）
- `content/`：内容脚本（三种阅读模式、划词弹窗、文本提取、朗读句子高亮 readAloud.ts）
- `tutor/`（语镜）、`corpus/`（语料库）：全屏标签页
- `offscreen/`：扩展上下文播放 TTS 音频，规避页面 CSP
- `permissions/`：麦克风授权页（侧边栏无法直接请求）
- `types/`：配置、消息协议等全部跨上下文类型的单一来源
- `providers/`：AI 服务商实现（DeepSeek / GLM / MiniMax / OpenAI / 自定义）

## 5. 构建与 CI

- 构建：Vite + vite-plugin-web-extension；Rust core 经 `scripts/build-web-core-wasm.sh` 编译为 WASM 后参与扩展构建
- CI（GitHub Actions，单产物 chrome-extension）：validate（typecheck/lint/build/test）→ package（zip）→ smoke
- 冒烟检查硬编码构建产物路径（`infra_scripts/artifacts/chrome-extension/smoke.sh`），重命名入口文件时需同步
