---
name: library-doctor
description: 体检 Lingride 资料库数据（结构/业务规则/hash/索引/源漂移），自动修复可修项并报告
---

# library-doctor

体检 `apps/browser-extension/src/library/data/` 的资料库数据。

## 步骤

1. 在仓库根目录运行：
   `npm run library:doctor --workspace apps/browser-extension -- --fix --source /Users/knox/Documents/GitWorkSpace/DocNoCode/softtech/English/RaiseChildInEntirelyEnglish/story-ppt/`
   （用户给了别的源目录则用用户的；不带 --source 会跳过源漂移与孤儿检测。）
2. 解读报告，按级别处理：
   - 🔧 fixable：`--fix` 已自动修（空白归一化/hash 重算/index 重建/孤儿删除），逐项列给用户；
   - ⚠️ warning：翻译成人话列出（如某集无儿歌、源已更新未同步 → 建议跑 library-sync-story）；
   - ❌ error：给出修复建议——能直接改 JSON 修的就顺手修（修完重跑一次本命令重算 hash），结构损坏严重则建议从源重新同步该集。
3. error 清零后提醒用户重新构建扩展验证。

## 注意

- doctor 只动 `src/library/data/` 下的 JSON，绝不改源目录。
- 手工编辑 JSON 后必须跑 `doctor --fix` 重算 hash，否则下次 sync 会报冲突。
