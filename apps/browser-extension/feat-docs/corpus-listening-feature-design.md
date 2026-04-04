## 设计目标与范围

### 设计目标
语料库听力功能旨在解决英语学习者**听写训练**场景下的三大问题：
1. **难度不匹配**：通用材料难以适配个人水平，过难导致挫败感，过易则收获有限。
2. **缺乏针对性反馈**：传统听写无法指出具体听力盲区（如连读、弱读、相似音混淆等）。
3. **学习闭环不完整**：练习后缺少基于 i+1 理论的诊断和改进建议。

目标用户为使用 Linguride Chrome 扩展的英语学习者，期望通过粘贴自选英文语料，获得按自身 CEFR 水平定制的听写练习及 AI 听力分析。

### 范围界定
本设计仅覆盖**Chrome 扩展内的语料库页面与相关后台能力**，包括：
- Popup 中的语料库入口、新标签页打开逻辑
- 语料库独立页面（输入、练习、分析、完成）
- Background Service Worker 中的 `SEGMENT_CORPUS`、`ANALYZE_LISTENING` 消息处理
- 浏览器内置 TTS 与 AI 对话能力

**不包含**：云端语料库、持久化听写记录、多设备同步、第三方 TTS 接入等。

---

## 整体架构与模块划分

### 架构分层
```
┌──────────────────────────────────────────────────────────────────────┐
│ Popup（popup.html / popup.ts）                                        │
│ - 语料库入口按钮                                                       │
│ - chrome.tabs.create() 打开 corpus.html 新标签页                      │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────┴───────────────────────────────────────┐
│ Corpus 页面（corpus.html / corpus.css / corpus.ts）                   │
│ - 输入区、练习区、分析区、完成区                                        │
│ - 本地 state 管理、TTS 调用、与 Background 消息交互                     │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ chrome.runtime.sendMessage
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Background Service Worker（service-worker.ts）                         │
│ - 消息路由：SEGMENT_CORPUS、ANALYZE_LISTENING                          │
│ - 获取配置、调用 Provider（DeepSeekProvider.chat）                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP / WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 外部 AI API（如 DeepSeek OpenAI 兼容接口）                             │
└─────────────────────────────────────────────────────────────────────┘
```

### 主要模块与职责

| 模块 | 路径 | 职责 |
|------|------|------|
| Popup 入口 | `popup/popup.html`, `popup.ts` | 语料库入口、`openCorpusPage()` 打开新标签页、关闭 Popup |
| 语料库页面 | `corpus/corpus.html`, `corpus.css`, `corpus.ts` | 输入语料、开始练习、TTS 播放、提交答案、展示分析、完成总结 |
| 类型定义 | `types/corpus.ts`, `types/messages.ts`, `types/index.ts` | `CorpusSentence`、`SegmentCorpusResult`、`ListeningError`、`ListeningAnalysisResult`、消息与响应类型 |
| Prompt 配置 | `constants/corpusPrompts.ts` | `SEGMENT_CORPUS_PROMPTS`、`ANALYZE_LISTENING_PROMPTS` |
| 后台处理 | `background/service-worker.ts` | `handleSegmentCorpus`、`handleAnalyzeListening`、Provider 调用与 JSON 解析 |
| 构建配置 | `src/manifest.json`, `vite.config.ts` | `web_accessible_resources` 中加入 `corpus.html`，`additionalInputs` 包含 Corpus 入口 |

---

## 关键数据模型

### 语料与断句

| 类型 | 字段 | 含义 | 使用场景 |
|------|------|------|----------|
| `CorpusSentence` | `text` | 句子原文 | 用于 TTS 朗读、听写对比 |
| | `difficulty` | i+1 难度说明 | 展示给用户了解难度 |
| | `keyWords` | 需注意的词汇 | 可选辅助展示 |
| | `listeningTips` | 听写提示（连读、弱读等） | 练习时提示 |
| `SegmentCorpusResult` | `sentences` | 断句结果列表 | 练习流程的数据源 |
| | `overallLevel` | 文本整体难度 | 展示与统计 |

### 听力错误与分析

| 类型 | 字段 | 含义 | 使用场景 |
|------|------|------|----------|
| `ListeningErrorType` | 枚举值 | `liaison` / `weakForm` / `similarSound` / `stress` / `intonation` / `vocabulary` / `speed` | 错误类型分类 |
| `ListeningError` | `expected` | 原文词/短语 | 对比展示 |
| | `actual` | 用户输入 | 对比与高亮 |
| | `type` | `ListeningErrorType` | 错误分类标签 |
| | `explanation` | 原因说明 | 错误列表说明 |
| | `tip` | 改进建议 | 错误列表与 hover |
| `ListeningAnalysisResult` | `accuracy` | 0–100 准确率 | 单句与整体统计 |
| | `errors` | `ListeningError[]` | 错误详情 |
| | `blindSpots` | `string[]` | 听力盲区 | 完成页总结 |
| | `suggestions` | `string[]` | 练习建议 | 单句分析与完成页 |
| | `encouragement` | `string` | 鼓励语 | 分析区展示 |

### 消息结构

| 类型 | 请求 payload | 响应 data | 说明 |
|------|--------------|-----------|------|
| `SegmentCorpusMessage` | `text`, `userLevel` | `SegmentCorpusResult` | 断句请求 |
| `AnalyzeListeningMessage` | `original`, `userInput`, `userLevel` | `ListeningAnalysisResult` | 听写分析 |

### 页面会话状态（`CorpusState`）

| 字段 | 类型 | 生命周期 | 说明 |
|------|------|----------|------|
| `sentences` | `CorpusSentence[]` | 开始练习 → 结束/新练习 | AI 断句结果 |
| `currentIndex` | `number` | 练习中 | 当前句子索引 |
| `results` | `(ListeningAnalysisResult \| null)[]` | 提交答案后写入、重练时清除本句 | 每句分析结果，`null` 表示跳过或未完成 |
| `overallLevel` | `string` | 与 `sentences` 同步 | 整体难度评估 |
| `playCounts` | `number[]` | 播放时递增 | 每句播放次数，用于 UI 与自动首次播放 |

---

## 主要交互流程

### 端到端流程（从 Popup 到一轮练习结束）

1. **入口**：用户点击 Popup 中语料库按钮 → `openCorpusPage()` → `chrome.tabs.create({ url: corpus.html })` → 关闭 Popup。
2. **输入**：用户粘贴英文语料，输入字数 ≥ 3 时启用「开始练习」。
3. **断句**：点击「开始练习」→ 发送 `SEGMENT_CORPUS` → Background 调用 AI → 返回 `SegmentCorpusResult` → 初始化 `state`，展示练习区。
4. **单句循环**：TTS 播放 → 用户听写输入 → 提交 → `ANALYZE_LISTENING` → 展示分析 → 下一句 / 重练 / 跳过。
5. **完成**：最后一句提交或跳过 → `showComplete()` → 展示统计、盲区、建议 → 可「开始新练习」重新输入语料。

### 单句听写交互时序

```
[Corpus 页面]                    [Background]                 [AI API]
     |                               |                             |
     |  handlePlaySentence()          |                             |
     |  speechSynthesis.speak()       |                             |
     |  (浏览器 TTS)                   |                             |
     |<------------------------------|                             |
     |                               |                             |
     |  handleSubmitAnswer()          |                             |
     |  ANALYZE_LISTENING ---------->| chat(system, user) -------->|
     |  showStatus("分析中...")        |                             |
     |                               |   parse JSON  <--------------|
     |   response.data  <-------------|                             |
     |  renderAnalysisResult()        |                             |
     |  切换 resultSection            |                             |
     |                               |                             |
     |  [用户点击 下一句]              |                             |
     |  handleNextSentence()          |                             |
     |  currentIndex++                |                             |
     |  renderCurrentSentence()       |                             |
     |                               |                             |
     |  [或 重新听写]                  |                             |
     |  handleRetry()                  |                             |
     |  results[i] = null             |                             |
     |  切回 practiceSection          |                             |
     |                               |                             |
     |  [或 跳过]                     |                             |
     |  handleSkipSentence()          |                             |
     |  results[i] = null             |                             |
     |  下一句或 showComplete()       |                             |
```

### 避免重复 AI 调用

- 仅在用户点击「提交答案」时发送 `ANALYZE_LISTENING`。
- 重练时只清除 `state.results[currentIndex]`，切回练习区并重新播放，不重新发起分析。
- 跳过时设 `results[i] = null`，不调用 AI。

---

## 前端页面与状态管理设计

### `corpus.html` 主要区域

| 区域 | ID | DOM 要点 |
|------|----|----------|
| 输入区 | `inputSection` | `corpusInput` textarea、`startPracticeBtn`、`corpusWordCount` |
| 练习区 | `practiceSection` | `progressFill`/`progressText`、`originalTextArea`、TTS 控件、`dictationInput`、`submitAnswerBtn`/`skipBtn` |
| 分析区 | `resultSection` | `sentenceAccuracy`、`comparisonOriginal`/`comparisonUser`、`errorsList`、`suggestionsList`、`retryBtn`/`nextSentenceBtn` |
| 完成区 | `completeSection` | `totalSentences`、`avgAccuracy`、`blindSpotsList`、`practiceAdviceList`、`newPracticeBtn` |

区域通过 `style.display` 切换，同一时刻通常只有一个区可见（输入 → 练习 → 分析 → 练习/完成 → 完成）。

### 状态管理（`corpus.ts` 中 `state`）

- 使用单一 `state: CorpusState \| null` 对象，练习开始前为 `null`。
- `initializePractice()` 创建 `state`，包含 `sentences`、`currentIndex`、`results`、`overallLevel`、`playCounts`。
- 更新时机：
  - `currentIndex`：下一句 / 跳过。
  - `results[i]`：提交后写入，重练或跳过时置 `null`。
  - `playCounts[i]`：TTS `onend` 时递增。
- 渲染逻辑：
  - `renderCurrentSentence()`：依据 `currentIndex`、`playCounts` 更新练习区。
  - `renderAnalysisResult()`：依据 `results[currentIndex]` 更新分析区。
  - `showComplete()`：聚合 `results` 计算平均准确率、盲区、建议。

### 事件绑定与初始化

- `DOMContentLoaded`：`checkTTSAvailability()`、`loadUserConfig()`、`bindEvents()`。
- 水平选择：`updateLevelBadge()`、`saveUserLevel()` 持久化到扩展配置。
- 语料输入：`handleCorpusInput()` 实时计词、启用/禁用按钮、短文本提示。
- 练习控制：播放、重播、提交、跳过、重练、下一句分别对应独立 handler。

---

## 与 Background / AI 的集成设计

### 消息类型与处理

| 消息类型 | 处理函数 | 逻辑概要 |
|----------|----------|----------|
| `SEGMENT_CORPUS` | `handleSegmentCorpus(text, userLevel)` | 校验 API Key、trim 文本、替换 `{{userLevel}}`/`{{text}}`、调用 `provider.chat()`、JSON 解析（含 fallback 提取代码块）、返回 `SegmentCorpusResult` |
| `ANALYZE_LISTENING` | `handleAnalyzeListening(original, userInput, userLevel)` | 校验 API Key、替换 `{{original}}`/`{{userInput}}`/`{{userLevel}}`、调用 `provider.chat()`、解析 JSON、补全 `ListeningAnalysisResult` 字段 |

解析失败时尝试匹配 ```json ... ``` 代码块；字段缺失时设置默认值（如 `encouragement: "继续努力！"`）。

### `corpusPrompts.ts` 设计

**断句 Prompt（i+1）**：
- 按 CEFR（A1–C2）约定每句词数、复杂度。
- 要求句子包含 1–2 个略超当前水平的词汇或结构。
- 输出 JSON：`sentences[]`（含 `text`、`difficulty`、`keyWords`、`listeningTips`）、`overallLevel`。
- 限制 `sentences` 最多 20 句；文本过短时直接返回原文作为单句。

**听力分析 Prompt（错误分类）**：
- 明确 7 类 `ListeningErrorType` 及示例。
- 输出 JSON：`accuracy`、`errors`、`blindSpots`、`suggestions`、`encouragement`。
- 约束：`type` 必须为枚举值；`errors` 仅列有问题的词；`blindSpots`/`suggestions` 分别最多 3 条。

**配置扩展**：当前 Prompt 为 `corpusPrompts.ts` 常量；配置层未暴露 `corpus_prompts`。可设计 `LingrideConfig.corpus_prompts`，从 `getConfig()` 读取，未配置时使用默认 Prompt。

### 用户等级来源

- 从 `GET_CONFIG` 响应中的 `user_english_level` 获取。
- 语料库页面支持本地切换水平，通过 `SAVE_CONFIG` 持久化。
- 断句与听力分析均使用当前 `userLevel` 替换 Prompt 占位符。

---

## 错误处理与优雅降级

| 场景 | 处理方式 | 用户反馈 |
|------|----------|----------|
| AI 断句失败 / 网络错误 | 使用 `fallbackSegment()` 按 `.!?` 简单分句 | 「智能分句暂不可用，使用简单分句模式」 |
| AI 听力分析失败 | 使用 `fallbackAnalysis()` 简单词匹配计算准确率 | 「详细分析暂不可用，显示简单对比结果」 |
| 网络中断 | `sendMessage` 抛出异常，`catch` 处理 | 「网络连接失败，请检查网络后重试」 |
| TTS 不可用 | `checkTTSAvailability()` 置 `isTTSAvailable = false` | 隐藏播放按钮，默认显示原文，提示「朗读功能不可用，请直接查看原文输入」 |
| 语料过短（< 10 词） | 允许继续，但给出 warning | 「语料较短，建议至少 50 词以获得更好的练习效果」 |
| 断句结果为空 | 不进入练习，恢复输入区 | 「未能识别到有效句子，请检查语料内容」 |
| 用户未输入即提交 | 提交按钮 `disabled`，由 `handleDictationInput` 控制 | - |
| API Key 未配置 | Background 返回 `success: false` | 通过 `response.error` 展示（如「请先配置 API Key」） |
| JSON 解析失败 | 尝试提取 ```json 代码块；仍失败则 `throw` | 透传错误信息或统一为「格式无效」类提示 |

---

## 安全性与性能考虑

### 数据与隐私

- 语料、听写内容仅存在于当前页面 `state` 与消息往返中，**不持久化**。
- 关闭标签页即丢弃全部会话数据。
- AI 调用经 Background 转发，使用用户自行配置的 API Key；扩展本身不收集或上传听写内容。

### 文本与句子限制

- Prompt 约定 `sentences` 最多 20 句；超长文本可能被 truncate 或拆分为多轮。
- 无硬性长文本上限，但过大会增加 token 消耗与响应延迟。
- UI 未对 TTS 单句长度做显式限制；极长句可能影响朗读体验。

### 与现有功能的关系

- **API Key**：与翻译、难度分析、外教、影子跟读共用 `getProviderConfig()`，统一配置。
- **Provider 调用**：与其它 AI 功能共享 `DeepSeekProvider`，无独立队列；并发请求可能受 API 限流影响。
- **TTS**：使用 `window.speechSynthesis`，与影子跟读、外教无冲突；语料库页面独立运行，不共享 TTS 状态。

---

## 可扩展性与后续演进建议

### 产品级扩展方向

- 多轮语料保存与进度续练：持久化 `SegmentCorpusResult` 与 `results`，支持「继续上次练习」。
- 多语种：扩展 CEFR 为多语种等级，或增加语种参数（如 `lang: "en" | "es"`）。
- 第三方 TTS：支持 ElevenLabs、Azure TTS 等，提供更自然的语音。
- 错误可视化：按 `ListeningErrorType` 统计图表、错误热力图等。

### 针对当前实现的改进建议

1. **Prompt 可配置化**：在配置中增加 `corpus_prompts`，与 difficulty、paraphrase 等一致，支持在设置中覆盖默认 Prompt。
2. **断句缓存**：对相同 `(text, userLevel)` 在会话内缓存 `SegmentCorpusResult`，避免重复断句。
3. **分析结果缓存**：对相同 `(original, userInput, userLevel)` 缓存 `ListeningAnalysisResult`，重练同一句时复用（或设 TTL 限制）。
4. **语料长度与句子数校验**：在 `handleStartPractice` 中对 token 或句数做上限校验，提前提示并裁剪或分段。
5. **完成页盲区与建议去重优化**：当前用 `Set` 去重并 `slice`；可引入简单聚合（如按 `ListeningErrorType` 统计），生成更结构化的总结。

