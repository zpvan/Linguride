# 长难句分析

> 在独立的"外教"标签页中提供英文长难句的 AI 结构化分析，帮助学习者理解复杂句式的句法结构、语法要点和核心含义。同时集成语音朗读、录音练习和 AI 发音评估功能。

## 解决什么问题

英语学习者在阅读时经常遇到结构复杂的长难句——多层嵌套从句、倒装、省略等。即使认识每个单词，仍然无法理解句意。传统做法是查语法书、问老师，效率低且不方便。

长难句分析功能让用户在浏览器中直接粘贴句子，一键获得六个维度的结构化拆解：翻译、主干、从句、短语、语法、简化改写。像"庖丁解牛"一样把复杂句子拆开给你看。

## 入口与页面架构

长难句分析（以及朗读、口语练习）功能从 Popup 中独立出来，作为"外教"标签页在独立 Tab 中运行，提供更大的操作空间和更好的用户体验。

- **Popup 入口**：Header 区域新增"外教"按钮（毕业帽+对话气泡图标），点击后通过 `chrome.tabs.create()` 打开外教标签页，同时关闭 Popup
- **外教标签页**：全屏响应式布局（`max-width: 800px` 居中），不受 Popup 的 380px 宽度和 600px 高度限制

```
┌─────────────────┐                    ┌──────────────────────────┐
│    Popup        │   tutorBtn click   │    外教标签页              │
│  (精简后)        │ ─────────────────→ │  (tutor.html)            │
│                 │  chrome.tabs.create │                          │
│  · 阅读模式选择   │                    │  · 长难句输入              │
│  · 水平选择      │                    │  · 分析 / 朗读 / 录音按钮  │
│  · 页面洞察      │                    │  · 分析结果展示            │
│  · 外教入口按钮 ◀─┘                    │  · 发音评估结果            │
└─────────────────┘                    └──────────────────────────┘
```

## 工作原理

```
用户输入句子 → 外教标签页发送 ANALYZE_SENTENCE 消息
    → Background Service Worker 接收
    → 读取 Prompt 配置（用户自定义 or 默认）
    → 替换 {{sentence}} 占位符
    → 调用 DeepSeekProvider.chat()
    → 解析 JSON 响应（直接解析 / 提取代码块 fallback）
    → 返回结构化结果
    → 外教标签页渲染为彩色卡片
```

核心流程只有三步：**输入 → AI 分析 → 结构化渲染**。用户无需关心背后的消息传递和 JSON 解析。

## 架构概览

```
┌─────────────┐    ANALYZE_SENTENCE     ┌─────────────────┐
│  外教标签页   │ ───────────────────────→ │   Background    │
│ (tutor.ts)  │                          │  Service Worker  │
│             │ ←─────────────────────── │                 │
│  渲染结果卡片  │    AnalyzeSentenceResponse │  handleAnalyze  │
└─────────────┘                          │   Sentence()    │
                                         └────────┬────────┘
                                                   │
                                         ┌─────────▼────────┐
                                         │  DeepSeekProvider │
                                         │     .chat()      │
                                         └──────────────────┘
```

与页面级功能（翻译/释义/混杂中英）不同，长难句分析是**纯标签页交互**——不依赖 Content Script，不操作页面 DOM。通过 `chrome.runtime.sendMessage` 与 Background Service Worker 通信。

## 主要模块

| 模块 | 文件 | 职责 |
|------|------|------|
| **类型定义** | `types/sentenceAnalysis.ts` | 定义分析结果、Prompt 配置等 TypeScript 接口 |
| **默认 Prompt** | `constants/sentenceAnalysisPrompts.ts` | 内置的 System/User Prompt 模板 |
| **配置扩展** | `types/config.ts` | LingridConfig 增加 `sentence_analysis_prompts` 字段 |
| **消息协议** | `types/messages.ts` | `ANALYZE_SENTENCE` 消息类型和响应接口 |
| **类型导出** | `types/index.ts` | 统一导出长难句分析相关类型 |
| **配置管理** | `background/configManager.ts` | 配置读写支持新字段的合并 |
| **后台处理** | `background/service-worker.ts` | `handleAnalyzeSentence()` + 消息路由 |
| **外教页面** | `tutor/tutor.html` | 输入区域 + 操作按钮 + 结果卡片 HTML 结构 |
| **外教逻辑** | `tutor/tutor.ts` | 事件绑定、分析触发、结果渲染、语音朗读、录音练习、发音评估 |
| **外教样式** | `tutor/tutor.css` | 全屏响应式布局、彩色标签、从句卡片、发音评估等样式 |
| **Popup 入口** | `popup/popup.html` + `popup/popup.ts` | Header 区域的"外教"入口按钮，通过 `chrome.tabs.create()` 打开外教标签页 |
| **构建配置** | `manifest.json` + `vite.config.ts` | `tutor.html` 注册为 `web_accessible_resources` 和 Vite 额外入口 |

## 技术亮点

### 1. 六维结构化分析

AI 返回的不是一段纯文本解释，而是严格的 JSON 结构，包含：

- **中文翻译** — 先让你知道句子在说什么
- **主干结构** (S/V/O/C) — 用彩色标签可视化主语、谓语、宾语、补语
- **从句拆解** — 标注类型（定语从句、状语从句等）、内容和功能
- **重点短语** — 提取关键词汇并附带中文释义
- **语法要点** — 针对该句的实际难点，不泛泛而谈
- **简化改写** — 用 A2-B1 水平的简单英语重新表达

### 2. JSON 解析三级 fallback

AI 返回的内容不总是标准 JSON，`handleAnalyzeSentence` 使用三级策略：
1. 直接 `JSON.parse()`
2. 正则提取 markdown 代码块中的 JSON
3. 抛出明确错误

### 3. Prompt 完全可定制

用户可在设置面板中修改 System Prompt 和 User Prompt 模板。`{{sentence}}` 占位符让用户可以自由调整提问方式，比如改成英文分析、调整输出格式等。所有修改即时生效，无需保存按钮。

### 4. 彩色句法可视化

主干结构使用四色标签系统：
- 🟦 **S**(主语) — 品牌青色
- 🟩 **V**(谓语) — 成功绿色
- 🟧 **O**(宾语) — 警告橙色
- 🟪 **C**(补语) — 紫色

视觉上一目了然，不需要阅读文字就能看清句子主干。

### 5. 智能显隐

- 简单句没有从句时，从句拆解区域自动隐藏
- 不及物动词句没有宾语时，O 标签不显示
- 没有补语时，C 标签不显示

避免显示空数据，保持界面整洁。
