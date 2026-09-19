# Linguride

> 把每一篇英文网页，变成你的英语课。

[![CI](https://github.com/zpvan/Linguride/actions/workflows/ci.yml/badge.svg)](https://github.com/zpvan/Linguride/actions/workflows/ci.yml)

**Linguride** 是一个 AI 驱动的英语学习项目，当前的产品形态是 Chrome 浏览器插件 **Lingride**。它基于「自行车学习法」（Bicycle Method）：像学自行车一样学英语——不是先背规则再上路，而是直接骑上去（进入真实阅读场景），在摇晃（犯错）中获得支撑（即时纠错与讲解），直到形成本能。

完整的产品愿景见 [docs/Linguride-PRD.md](docs/Linguride-PRD.md)（中文）。

## 设计理念

- **隐形学习（Invisible Learning）**：你是在"读文章"，不是在"学习"。学习发生在真实的阅读动机里，而不是另一个需要打开的 App 里。
- **零摩擦（Zero Friction）**：点击图标即开始，没有课程表、没有打卡、没有复杂设置。
- **即时反馈（Instant Gratification）**：每次使用都有可感知的收获——看懂了一段话、学会了一种表达。
- **平静技术（Calm Technology）**：干净的界面，内容为主角，工具退到幕后。

## 适合谁

- **有一定英语基础（约初中以上），想突破"看得懂单词但读不顺句子"阶段的学习者**——用你真实感兴趣的英文内容（技术博客、新闻、文档）作为学习材料；
- **每天需要阅读英文资料的开发者、研究者、外贸从业者**——把日常阅读时间自然转化为学习时间；
- **想练口语和听力但缺乏环境的人**——内置发音评估、影子跟读和听力训练。

如果你是完全零基础，或者需要的是应试刷题（四六级题库、雅思模考），这个项目可能不适合你。

## 功能特性

### 📖 三种阅读模式（作用于任意英文网页）

| 模式 | 说明 |
|---|---|
| **释义** | 将英文改写为适合你水平的版本（i+1 可理解输入） |
| **混杂** | 保留你能读懂的英文，只把超纲部分替换为中文 |
| **翻译** | 双语对照，原文下方显示中文 |

### 📊 难度分析

一键分析当前页面或选中文本的难度等级、CEFR 等级、词汇/句子复杂度和学习建议，帮你判断"这篇文章适不适合现在的我读"。

### 🔊 阅读全文

逐句朗读当前网页（中英文均可），当前朗读的句子实时高亮并自动滚动跟随。合成当前句的同时预合成下一句，句间无停顿。

### 🎓 语镜（Tutor）

独立标签页中的练习场：中译英 / 英译中 / 英英释义、长难句拆解、发音评估、影子跟读（AI 实时评估你的跟读）。

### 🎧 语料库（Corpus）

粘贴英文语料，按你的 CEFR 水平进行 i+1 听写训练，并生成听力问题分析。

### ⚙️ 可配置的服务商

所有能力都可以自由选择服务商，自己的 Key 自己管：

- **AI 对话**：DeepSeek / GLM / MiniMax / OpenAI（API Key 或 ChatGPT OAuth）/ 任意 OpenAI 兼容端点
- **语音合成（TTS）**：MiniMax / 小米 / 豆包 / 浏览器朗读（失败自动回退浏览器）
- **语音识别（ASR）**：MiniMax / 小米 / 豆包 / 浏览器识别（默认复用对应 TTS 的 API Key，无需重复配置）
- **Prompt 全开放**：翻译、释义、混杂、难度分析、长难句分析的 Prompt 均可在设置中修改

## 安装与使用

### 安装

**方式一：下载 CI 构建产物（推荐）**

在 [Actions](https://github.com/zpvan/Linguride/actions/workflows/ci.yml) 页面选择最近一次成功的 `main` 分支构建，下载 `chrome-extension-<sha>` 产物并解压。

**方式二：从源码构建**

```bash
git clone https://github.com/zpvan/Linguride.git
cd Linguride
npm install
npm run build:browser-extension
# 产物在 apps/browser-extension/dist
```

**加载到 Chrome**：

1. 打开 `chrome://extensions`，开启右上角「开发者模式」
2. 点击「加载已解压的扩展程序」，选择 `dist`（或解压后的）目录
3. 要求 Chrome 114+（侧边栏 API）

### 配置

点击工具栏的 Lingride 图标，在右侧展开的侧边栏中点右上角 **⚙️ 齿轮** 进入设置：

1. **AI 服务（必填）**：选择服务商并填入 API Key，点「测试连接」验证。没有 Key 的话推荐从 [DeepSeek](https://platform.deepseek.com/) 开始，注册即有额度
2. **语音合成（可选）**：想用「阅读全文」「发音评估」的 AI 音色，配置 MiniMax / 小米 / 豆包任一的 Key；不配置则回退浏览器朗读（阅读全文不可用）
3. **语音识别（可选）**：想用发音评估和影子跟读，ASR 默认复用语音合成的 Key，通常无需额外配置

回到侧边栏主页，选择你的英语水平（Lv.A1 ~ C2），点选一种阅读模式，开始读你本来就想读的文章。

**快捷键**：`⌘⇧Y`（Mac）/ `Ctrl+Shift+Y`（Windows/Linux）开关侧边栏。

## 开发

```
apps/browser-extension/   # Chrome 扩展（唯一产物）
packages/contracts-ts/    # 共享 TS 契约
bindings/web-core/        # Rust → WASM 绑定
crates/                   # Rust 核心逻辑（linguride-core / linguride-domain）
infra_scripts/            # 构建与 CI 脚本
```

常用命令（仓库根目录）：

```bash
npm run typecheck:browser-extension   # 类型检查
npm run lint:browser-extension        # Lint
npm run build:browser-extension       # 构建
CI=true npm run test --workspace apps/browser-extension   # 测试
```

更详细的架构说明见 [CLAUDE.md](CLAUDE.md)。

## 提 Issue

我们非常欢迎反馈。好的 Issue 能显著加快修复速度，建议包含：

- **bug 反馈**：问题现象、复现步骤、出现问题的网页 URL（如果与特定页面相关）、Chrome 版本、扩展版本，以及侧边栏里的错误提示截图或文本。如果方便，附上 `chrome://extensions` 中 Lingride 的「Service Worker」控制台报错
- **功能建议**：你想解决什么问题、期望的使用方式。描述场景比描述方案更有价值
- **服务商兼容性**：某个 AI/TTS/ASR 服务商配置后不可用，请附上设置页「测试连接」的错误信息（注意打码你的 API Key）

提交前请先搜索 [已有 Issue](https://github.com/zpvan/Linguride/issues) 避免重复。

## 隐私

插件不收集任何数据，API Key 仅存本机，详见 [PRIVACY.md](PRIVACY.md)。权限申请保持最小化（不申请 `tabs` / `history` / `cookies` 等）。

## License

[MIT](LICENSE)
