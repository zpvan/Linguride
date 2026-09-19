# Lingride Chrome Extension

Lingride 是一个面向英语学习场景的 Chrome 扩展，覆盖网页阅读、句子辅助、口语练习和听力训练。它把 AI 翻译、释义、难度分析、语音识别和语音合成集中在一个扩展里，方便在浏览网页时直接切换学习模式。

## 功能概览

- 网页阅读模式：在英文网页上切换 `翻译`、`释义`、`混杂` 三种模式。
- 页面难度分析：提取当前页面或选中文本，输出难度等级、CEFR 参考等级和学习建议。
- 语镜页面：支持中译英、英译中、英英释义、长难句分析、影子跟读和发音评估。
- 语料库页面：粘贴英文语料后按 CEFR 水平进行 i+1 听写训练，并生成听力问题分析。
- 可选云端语音能力（TTS 与 ASR 均为 MiniMax / 小米 / 豆包 / 浏览器，ASR 默认复用对应 TTS 的 API Key）
- Prompt 可配置：翻译、释义、混杂中英、难度分析、长难句分析都可在设置中调整。
- 多 provider 支持：DeepSeek、GLM、MiniMax、OpenAI、自定义 OpenAI 兼容端点。
- OpenAI 两种认证方式：API Key 和 ChatGPT OAuth。

## 安装

### 方式一：使用安装脚本

先在仓库根目录执行一次：

```bash
npm install
```

然后任选一种方式：

```bash
npm run install:mac --workspace apps/browser-extension
```

或者：

```bash
cd apps/browser-extension
npm run install:mac
```

`npm run install:mac` 会：

1. 构建扩展
2. 打开 `chrome://extensions/`
3. 复制 `apps/browser-extension/dist` 路径到剪贴板

### 方式二：手动安装

先在仓库根目录执行一次：

```bash
npm install
```

然后从仓库根目录执行：

```bash
npm run build:browser-extension
```

或者在扩展目录中执行：

```bash
cd apps/browser-extension
npm run build
```

然后在 Chrome 中：

1. 打开 `chrome://extensions/`
2. 开启“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择仓库内的 `apps/browser-extension/dist/` 目录

## 开发

先在仓库根目录执行一次：

```bash
npm install
```

然后从仓库根目录执行：

```bash
npm run dev:browser-extension
```

或者在扩展目录中执行：

```bash
cd apps/browser-extension
npm run dev
```

常用命令：

- `npm run dev`：启动 Vite 开发流程
- `npm run build`：运行 `tsc` 并输出到 `dist/`
- `npm run preview`：预览构建结果
- `npm run install:mac`：构建后辅助安装到 Chrome

也支持 Bun：

```bash
bun install
bun run build
```

## 配置说明

扩展设置为即时生效，配置变更会自动保存，不需要单独点击“保存设置”。

### AI 服务

- `DeepSeek`：默认端点为 `https://api.deepseek.com`
- `GLM`：默认端点为 `https://open.bigmodel.cn/api/paas/v4/`
- `MiniMax`：默认端点为 `https://api.minimaxi.com/anthropic`，走 Anthropic-compatible Messages 接口
- `OpenAI`：
  - `API Key` 模式：使用 OpenAI API Key 和模型名
  - `ChatGPT OAuth` 模式：在浏览器完成授权后，将 `localhost` 回调地址或 `code` 粘贴回扩展完成登录
- `自定义`：可填写兼容 OpenAI 接口的自定义端点和模型

设置页支持：

- 测试当前 AI 连接
- 同步 OpenAI 官方模型目录
- 配置翻译、释义、混杂中英、难度分析、长难句分析相关 Prompt

### 语音识别服务

影子跟读和口语训练默认可回退到浏览器内置语音识别，也可以配置：

- 腾讯云 ASR：`AppID`、`SecretID`、`SecretKey`
- 阿里云 ASR：百炼 `API Key`

固定优先级为：腾讯云 -> 阿里云 -> 浏览器内置。

### 语音合成服务

如果未配置云端 TTS，扩展会回退到浏览器朗读。可选配置：

- MiniMax TTS：固定端点 `https://api.minimax.io/v1`
- 小米 TTS：固定端点 `https://api.xiaomimimo.com/v1`，支持音色和风格标签

固定优先级为：MiniMax -> 小米 -> 浏览器朗读。

### 麦克风权限

需要录音时，扩展会通过 `permissions.html` 引导用户授权麦克风权限。授权成功后即可在语镜等页面使用录音能力。

## 使用入口

### Popup

点击扩展图标后可进行：

- 切换网页阅读模式：`释义`、`混杂`、`翻译`
- 分析当前页面难度
- 打开 `语镜`
- 打开 `语料库`
- 配置 AI / ASR / TTS / Prompt

### 语镜

`语镜` 是独立页面，适合句子级训练：

- 中译英
- 英译中
- 英英释义
- 长难句分析
- 影子跟读
- 发音评估与反馈

### 语料库

`语料库` 是独立页面，适合听力练习：

1. 粘贴英文语料
2. 让 AI 按当前 CEFR 水平进行断句
3. 逐句听写
4. 查看准确率、盲区和练习建议

## 项目结构

```text
apps/browser-extension/
├── src/
│   ├── background/   # Service worker、provider 路由、OAuth、模型目录、配置状态
│   ├── content/      # 网页注入、提取、缓存、批处理、选择工具条
│   ├── popup/        # 主入口 UI、模式切换、设置面板
│   ├── tutor/        # 语镜页面
│   ├── corpus/       # 语料库听力训练页面
│   ├── permissions/  # 麦克风授权页
│   ├── providers/    # AI provider 实现
│   ├── shared/       # 跨页面共享逻辑，例如 hybrid TTS
│   ├── constants/    # Prompt 与常量
│   ├── types/        # 类型定义与消息契约
│   └── manifest.json
├── public/icons/     # 扩展图标
├── scripts/          # 安装与资源脚本
├── docs/             # 设计规范文档
├── feat-docs/        # 功能设计与实现说明
└── AGENTS.md         # 仓库协作说明
```

## 相关文档

- `docs/UI-STYLE-GUIDE.md`：Popup / Tutor 等界面的 UI 设计规范
- `feat-docs/`：语料库、影子跟读、句子分析、发音评估等功能设计说明
- `AGENTS.md`：仓库结构、开发命令、验证要求和协作约束
