---
name: library-sync-story
description: 把 story-ppt 源资料同步进 Lingride 资料库（导入新剧集/应用上游更新），并确保校验零错误
---

# library-sync-story

把 story-ppt 源目录的剧集同步到 `apps/browser-extension/src/library/data/`。

## 步骤

1. 确认源目录：默认 `/Users/knox/Documents/GitWorkSpace/DocNoCode/softtech/English/RaiseChildInEntirelyEnglish/story-ppt/`；用户给的路径优先。
2. 在仓库根目录运行：
   `npm run library:sync --workspace apps/browser-extension -- --source <源目录>`
   （也可在 `apps/browser-extension/` 内运行 `npm run library:sync -- --source <源目录>`。不要用 `npx tsx ... --source <路径>`——npx 会吞掉空格形式的参数。）
3. 解读摘要（新增/更新/冲突/手改保留/无变化）：
   - **冲突**（源与 JSON 手改双变更）：逐条报告给用户，给两个选择——
     保留手改：跑 `npm run library:doctor --workspace apps/browser-extension -- --fix` 重算 hash；
     以源为准：删除 `src/library/data/stories/<id>.json` 后重跑 sync。
   - **孤儿**：提示用户可跑 doctor --fix 清理。
   - sync 输出 error：未写入任何文件，把错误翻译成人话，修源数据后重跑。
4. 跑 `npm run library:doctor --workspace apps/browser-extension -- --source <源目录>` 确认零 error。
5. 提醒用户：`npm run build:browser-extension` 后到 `chrome://extensions` 重载 dist 验证。
