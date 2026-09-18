# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Linguride** is an AI-powered English learning project based on the "Bicycle Method" – immersive, contextual language acquisition. 产品愿景与方法论详见 `/docs/Linguride-PRD.md`（中文）。

**Current Status**: 仓库当前仅维护一个产物 —— **Chrome 浏览器插件 Lingride**（`apps/browser-extension`）。Android / Desktop / VSCode 产物已于 2026-09 移除（见 `bdbee63`），其规划内容只保留在 docs 中作为愿景文档。

## Repository Layout

```
apps/browser-extension/   # Chrome MV3 扩展（唯一产物）
packages/contracts-ts/    # 共享 TS 契约（DTO / 配置类型），扩展的直接依赖
bindings/web-core/        # Rust → WASM 绑定（wasm-bindgen），供扩展使用
crates/linguride-core/    # Rust 核心逻辑（reader/tutor/corpus/session 等）
crates/linguride-domain/  # Rust 领域模型
infra_scripts/            # 构建/CI 脚本（artifact 制：仅 chrome-extension）
docs/, feat-docs/, spec/  # 产品文档（PRD 描述的多平台为远期愿景，非现状）
```

## Browser Extension Architecture

技术栈：TypeScript + Vite + `vite-plugin-web-extension`，Manifest V3，无框架原生 DOM。

- **入口**：`src/manifest.json`（构建时由 vite 插件处理；`side_panel` 指向侧边栏页面）
- **侧边栏** `src/sidepanel/`：点击工具栏图标在浏览器右侧展开（`chrome.sidePanel` + `openPanelOnActionClick`，Chrome 114+），学习控制中心 + 设置（右上角齿轮进入设置视图）。快捷键 ⌘⇧Y / Ctrl+Shift+Y
- **后台** `src/background/service-worker.ts`：消息路由、AI API 调用、配置管理（chrome.storage）、TTS 合成任务、ASR 鉴权（豆包走 DNR 会话规则注入 WS 鉴权头）
- **内容脚本** `src/content/`：双语翻译 / 释义 / 混杂三种阅读模式、划词弹窗、文本提取
- **全屏标签页**：`src/tutor/`（语镜：长难句分析、发音评估、影子跟读）、`src/corpus/`（语料库听力训练）
- **Offscreen 文档** `src/offscreen/`：在扩展上下文播放 TTS 音频，规避页面 CSP
- **权限页** `src/permissions/`：麦克风授权（侧边栏无法直接请求）

服务提供商（设置页可配，均支持"测试连接"）：
- **AI**：DeepSeek / GLM / MiniMax / OpenAI（API Key 或 ChatGPT OAuth）/ 自定义端点
- **语音合成 TTS**：MiniMax / 小米 / 豆包 / 浏览器朗读（失败自动回退浏览器）
- **语音识别 ASR**：MiniMax / 小米 / 豆包 / 浏览器识别（顺序与 TTS 一致；默认复用对应 TTS 的 API Key，见 `resolveDoubaoASRApiKey` / `resolveXiaomiASRApiKey` / `isMiniMaxASRConfigured` in `src/types/config.ts`）

## Development Commands

在仓库根目录（推荐，会先构建 wasm/contracts 依赖）：

```bash
npm run typecheck:browser-extension   # 类型检查
npm run lint:browser-extension        # ESLint
npm run build:browser-extension       # 构建到 apps/browser-extension/dist
npm run test --workspace apps/browser-extension --if-present   # vitest（本地需 CI=true 避免 watch 模式挂起）
```

在 `apps/browser-extension/` 内可单独跑 `npm run dev / build / typecheck / lint / test`（`npx vitest run` 跑一遍测试）。

加载扩展：`chrome://extensions` → 开发者模式 → 加载 `apps/browser-extension/dist`。

## CI

- **GitHub Actions** `.github/workflows/ci.yml`：单产物 chrome-extension，`validate`（typecheck/lint/build/test）+ `package`（打 zip）+ `smoke`。脚本入口：`infra_scripts/ci/github/{test,package,smoke}.sh` → `infra_scripts/artifacts/chrome-extension/*.sh`
- **冒烟检查硬编码了构建产物路径**（如 `dist/src/sidepanel/sidepanel.html`），重命名入口文件时需同步 `infra_scripts/artifacts/chrome-extension/smoke.sh`
- **Jenkins**：根 `Jenkinsfile`（浏览器插件门禁）

## Conventions

- Commit message：Conventional Commits + scope，中文描述，如 `fix(browser-extension): ...`
- 源码文件头部带 `@file` / `@description` 注释块（中文），新增文件保持一致
- UI 文案与代码注释以中文为主
- `chrome.sidePanel` 打开侧边栏**不会授予 activeTab 权限**；`chrome.scripting.executeScript` 注入依赖 manifest 中的 `<all_urls>` host 权限
