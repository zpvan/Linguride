# 语料库听力训练界面优化 设计文档

- 日期：2026-09-05
- 范围：`apps/browser-extension/src/corpus`（+ types/constants 各一处）
- 状态：已获用户批准（分节确认）

## 背景

语料库听力训练页两处界面优化：

1. "重新朗读"按钮与"朗读句子"按钮功能重复（`handleReplaySentence` 只是转调 `handlePlaySentence`，播放按钮本身有播放/停止双态），移除；
2. 展示原句时，除"听写提示"外新增一行：整句的美式 IPA 音标。

## 1. 移除"重新朗读"按钮

- `corpus.html`：删除 `replayBtn` 按钮元素；
- `corpus.css`：删除 `.btn-tts.btn-replay` 规则；
- `corpus.ts`：删除 `replayBtn` DOM 引用、`handleReplaySentence` 函数、对应事件绑定，以及 `renderCurrentSentence` 中两处 `replayBtn.style.display` 切换。

## 2. 原句音标行

### 数据流

- **类型**：`types/corpus.ts` 的 `CorpusSentence` 新增可选字段 `phonetics?: string`——整句美式 IPA，形如 `/ðə kwɪk braʊn fɑːks/`；
- **生成**：`constants/corpusPrompts.ts` 的 `SEGMENT_CORPUS` prompt 要求 AI 对每个句子附带 `phonetics` 字段（美式发音 GA、整句连续、斜杠包裹、词间空格分隔）；
- **透传**：service worker `handleSegmentCorpus` 解析 AI 断句结果时透传 `phonetics`；
- **降级**：AI 未返回该字段、或标点兜底分句（`fallbackSegment`）时 `phonetics` 为 undefined → 音标行隐藏，不影响现有流程。

### UI

- `corpus.html`：`originalTextArea` 内"听写提示"行下方新增一行：`音标：` 标签 + `phoneticsText` 内容，复用 `sentence-tips` 样式，新增 `.sentence-phonetics` 做等宽/斜体微调；
- `corpus.ts`：`renderCurrentSentence` 填充音标并控制该行显隐。

## 错误处理与边界

- AI 返回非法/缺失 `phonetics`：按缺失处理，隐藏音标行；
- 标点兜底分句：无音标，行隐藏；
- 无任何新增网络请求（音标随断句响应一起返回）。

## 测试

- 现有测试不受影响（无 corpus 页单测）；prompt 变更通过 `bun run build` 后人工验证；
- 手动验证点：移除按钮后布局无残留空隙；AI 断句路径显示音标行；兜底分句路径音标行隐藏。

## 非目标（YAGNI）

- 不做逐词对照/英美双标注（用户已选单行美式音标串）；
- 不做音标点击发音等交互。
