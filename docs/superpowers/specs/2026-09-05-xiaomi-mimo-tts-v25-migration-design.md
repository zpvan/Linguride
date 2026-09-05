# 小米 MiMo TTS 迁移至 v2.5 设计文档

- 日期：2026-09-05
- 范围：`apps/browser-extension`（service worker / types / popup）
- 状态：已获用户批准（分节确认）

## 背景

设置页"语音合成服务 → 小米"不可用。对照官方 v2.5 文档（`https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/speech-synthesis-v2.5`），当前实现存在三处过期：

| 项 | 插件当前 | 官方 v2.5 |
|---|---|---|
| 模型 | `mimo-v2-tts` | 仅 `mimo-v2.5-tts` / `-voicedesign` / `-voiceclone` |
| 音色 | `mimo_default / default_zh / default_en` | `mimo_default / 冰糖 / 茉莉 / 苏打 / 白桦 / Mia / Chloe / Milo / Dean` |
| 风格 | `<style>` 标签注入（v2 标签：孙悟空/林黛玉/方言等） | 自然语言风格描述（user 消息）/新音频标签 |

请求结构（chat/completions + user/assistant 消息 + audio 对象）与鉴权（`api-key` header）与 v2.5 一致，无需改动。最可能的根因是 v2 模型与旧音色 ID 被下线。

## 1. 实测验证根因

用用户的小米 API key 跑两次 curl 对比（一次性脚本，放 `scripts/`）：

1. `mimo-v2-tts` + 旧音色 `default_en` → 预期报错（确认下线）
2. `mimo-v2.5-tts` + 新音色 `Mia` → 预期成功（确认迁移目标可用）

## 2. 迁移改动

- **模型**：`XIAOMI_TTS_MODEL`（`types/config.ts`）从 `mimo-v2-tts` 改为 `mimo-v2.5-tts`；
- **音色**：`XiaomiTTSVoice` 收窄为 `"mimo_default" | "Mia" | "Chloe" | "Milo" | "Dean"`；`XIAOMI_TTS_VOICE_OPTIONS` 同步；`normalizeXiaomiTTSVoice` 将旧值 `default_zh`/`default_en` 迁移为 `mimo_default`；
- **请求体**：`buildXiaomiTTSAssistantContent` 简化为直接返回原文，不再注入 `<style>` 标签；
- **风格选项移除**：删除 `XiaomiTTSStyleSelection` 类型、`XIAOMI_TTS_STYLE_*` 常量与 `normalizeXiaomiTTSStyles`/`hasXiaomiTTSStyles` 辅助函数、popup 风格选择 UI（语速/情绪/角色/腔调/方言五个分组）；旧配置中的 `styles` 字段读取时忽略（不删除用户数据）；
- **popup 音色下拉**：更新为 默认音色 / Mia（女声）/ Chloe（女声）/ Milo（男声）/ Dean（男声）。

## 3. 测试与验证

- `normalizeXiaomiTTSVoice` 旧值迁移单测；
- `bun run typecheck && bunx vitest run && bun run build && bun run lint`（CI 有 lint gate，0 errors 才过）；
- 设置页"测试连接"用真实 key 实测。

## 非目标（YAGNI）

- 不接入 voicedesign / voiceclone 模型；
- 不迁移风格标签到 v2.5 体系（先恢复可用，风格功能后续按 v2.5 文档重做）；
- 不改中文音色（本应用为英语学习场景，仅开放英文音色）。
