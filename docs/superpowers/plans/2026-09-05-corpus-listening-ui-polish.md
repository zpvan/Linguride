# 语料库听力训练界面优化 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除语料库听力训练页冗余的"重新朗读"按钮，并在展示原句时新增一行整句美式 IPA 音标。

**Architecture:** 音标随 AI 断句响应返回（`CorpusSentence.phonetics` 可选字段），不新增网络请求；`handleSegmentCorpus` 对 sentences 数组原样透传，无需改动 service worker；无音标数据时 UI 行隐藏。

**Tech Stack:** TypeScript、Chrome Extension MV3、vitest。

**Spec:** `docs/superpowers/specs/2026-09-05-corpus-listening-ui-polish-design.md`

**工作目录：** `apps/browser-extension`（以下相对路径均相对于它）

---

### Task 1: 移除"重新朗读"按钮

**Files:**
- Modify: `src/corpus/corpus.html`
- Modify: `src/corpus/corpus.css`
- Modify: `src/corpus/corpus.ts`

- [ ] **Step 1: 删除 HTML 按钮**

在 `src/corpus/corpus.html` 的 `.tts-controls` 区块中删除整个 replay 按钮（约 line 113-118）：

```html
          <button id="replayBtn" class="btn-tts btn-replay" title="重新朗读">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 4v6h6"></path>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
          </button>
```

- [ ] **Step 2: 删除 CSS 规则**

在 `src/corpus/corpus.css` 中删除：

```css
.btn-tts.btn-replay {
  background: var(--bg-quaternary);
  color: var(--text-primary);
}
```

- [ ] **Step 3: 删除 corpus.ts 中的引用**

3a. 删除 DOM 引用（约 line 103）：

```ts
const replayBtn = document.getElementById("replayBtn") as HTMLButtonElement;
```

3b. 删除事件绑定（`bindEvents` 中约 line 295）：

```ts
  replayBtn.addEventListener("click", handleReplaySentence);
```

3c. `renderCurrentSentence` 中删除两处 display 切换。TTS 不可用分支（约 line 545）：

```ts
    playBtn.style.display = "none";
    replayBtn.style.display = "none";
```

改为：

```ts
    playBtn.style.display = "none";
```

正常分支（约 line 550）：

```ts
    playBtn.style.display = "";
    replayBtn.style.display = "";
```

改为：

```ts
    playBtn.style.display = "";
```

3d. 删除函数（`handlePlaySentence` 之后）：

```ts
function handleReplaySentence(): void {
  handlePlaySentence();
}
```

- [ ] **Step 4: 类型检查 + 构建**

Run: `cd apps/browser-extension && bun run typecheck && bun run build`
Expected: 无错误，构建成功

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/corpus/corpus.html apps/browser-extension/src/corpus/corpus.css apps/browser-extension/src/corpus/corpus.ts
git commit -m "refactor(browser-extension): 移除语料库页冗余的重新朗读按钮"
```

---

### Task 2: 音标数据流（类型 + Prompt）

**Files:**
- Modify: `src/types/corpus.ts`
- Modify: `src/constants/corpusPrompts.ts`

- [ ] **Step 1: CorpusSentence 新增 phonetics 字段**

在 `src/types/corpus.ts` 的 `CorpusSentence` 中，`listeningTips` 之后追加：

```ts
/** 语料句子 */
export interface CorpusSentence {
  /** 句子原文 */
  text: string;
  /** i+1 难度说明 */
  difficulty: string;
  /** 需要注意的词汇 */
  keyWords: string[];
  /** 听写提示（如：注意连读、弱读等） */
  listeningTips: string;
  /** 整句美式 IPA 音标（可选，如 /ðə kwɪk braʊn fɑːks/） */
  phonetics?: string;
}
```

- [ ] **Step 2: 断句 Prompt 要求输出音标**

在 `src/constants/corpusPrompts.ts` 的 `SEGMENT_CORPUS_PROMPTS.system_prompt` 中：

2a. JSON 格式示例（`"listeningTips"` 行）之后追加一行：

```
      "listeningTips": "听写提示，如：注意 'want to' 的连读发音 /wɑnə/",
      "phonetics": "整句美式音标，如：/ðə kwɪk braʊn fɑːks dʒʌmps ˈoʊvər ðə ˈleɪzi dɔːɡ/"
```

2b. `注意：` 列表中 `- listeningTips 要指出具体的听力难点（连读、弱读、重音等）` 之后追加一行：

```
- phonetics 为整句的美式发音（GA）IPA 音标，斜杠包裹、词间空格分隔
```

- [ ] **Step 3: 类型检查**

Run: `cd apps/browser-extension && bun run typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/browser-extension/src/types/corpus.ts apps/browser-extension/src/constants/corpusPrompts.ts
git commit -m "feat(browser-extension): 语料断句 prompt 要求输出整句美式音标"
```

---

### Task 3: 音标行 UI

**Files:**
- Modify: `src/corpus/corpus.html`
- Modify: `src/corpus/corpus.css`
- Modify: `src/corpus/corpus.ts`

- [ ] **Step 1: HTML 新增音标行**

在 `src/corpus/corpus.html` 的 `originalTextArea` 区块中，"听写提示"行之后追加（约 line 96-99 之后）：

```html
          <div id="sentenceTips" class="sentence-tips">
            <span class="tips-label">听写提示：</span>
            <span id="listeningTips" class="tips-content"></span>
          </div>
          <div id="sentencePhonetics" class="sentence-tips" style="display: none;">
            <span class="tips-label">音标：</span>
            <span id="phoneticsText" class="tips-content phonetics-content"></span>
          </div>
```

- [ ] **Step 2: CSS 新增音标样式**

在 `src/corpus/corpus.css` 的 `.tips-label` 规则（约 line 480-483）之后追加：

```css
/* 音标行 */
.phonetics-content {
  font-style: italic;
  color: var(--text-secondary);
}
```

- [ ] **Step 3: corpus.ts 接入**

3a. DOM 引用区，在 `const listeningTips = ...`（约 line 94）之后追加：

```ts
const sentencePhonetics = document.getElementById("sentencePhonetics") as HTMLElement;
const phoneticsText = document.getElementById("phoneticsText") as HTMLElement;
```

3b. `renderCurrentSentence` 中，`listeningTips.textContent = sentence.listeningTips || "注意听清每个单词";` 之后追加：

```ts
  // 音标行（无数据时隐藏）
  if (sentence.phonetics) {
    phoneticsText.textContent = sentence.phonetics;
    sentencePhonetics.style.display = "";
  } else {
    sentencePhonetics.style.display = "none";
  }
```

- [ ] **Step 4: 类型检查 + 构建 + 全量测试**

Run: `cd apps/browser-extension && bun run typecheck && bun run build && bunx vitest run`
Expected: 无错误；构建成功；全部测试 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/corpus/corpus.html apps/browser-extension/src/corpus/corpus.css apps/browser-extension/src/corpus/corpus.ts
git commit -m "feat(browser-extension): 语料库页原句展示新增整句美式音标行"
```

---

### Task 4: 人工验证

- [ ] **Step 1: 加载插件实测**

`dist/` 构建产物加载到 Chrome，打开语料库听力训练：

1. 粘贴一段英文语料开始练习（AI 断句路径）→ 朗读控制区只剩一个播放按钮，无"重新朗读"；
2. 听写提交后展示原句 → 听写提示下方出现"音标：/ðə …/"一行；
3. 断网触发标点兜底分句 → 音标行隐藏、其余功能正常。

- [ ] **Step 2: 最终 Commit（如有修复）**

```bash
git add -A apps/browser-extension
git commit -m "fix(browser-extension): 人工验证发现的问题修复"
```
