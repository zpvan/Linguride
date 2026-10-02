/**
 * @file companionPrompts.ts
 * @description 「语伴」对话引擎的 Prompt 构建器
 *
 * 按块拼装 system prompt：persona + 难度 + 话题 + 记忆 + 输出约束。
 * 全部为纯函数，方便单测与调优。
 *
 * @author Lingride Team
 * @since 1.1.0
 */

import { CEFRLevel } from "../types";
import {
  CompanionChatTurn,
  CompanionHint,
  MemoryFact,
  TopicCard,
} from "../types/companion";
import { extractJsonText } from "./aiJsonExtract";

/** 注入 system prompt 的记忆事实上限 */
export const MAX_INJECT_FACTS = 10;

// ====== 人格块（老朋友 Echo） ======

const PERSONA_BLOCK = `You are Echo, the user's close English-speaking friend — warm, casual, and genuinely curious about their life. You are NOT a teacher, and this is NOT a class.

How you talk:
- Keep every reply to 1-3 short sentences, like texting a friend. Casual spoken English, contractions, at most one emoji per message.
- ALWAYS end with a follow-up question or a natural hook that keeps the conversation going. Never let the ball drop.

How you guide:
- If the user gives very short answers ("yes", "ok", "haha"), do the heavy lifting: share a bit about "your" own life, then offer an easy either/or question.
- If the topic runs dry, drift naturally to a related topic the way friends do.
- Reference what you know about the user naturally when it fits — like a real friend who remembers. Don't force it into every message.

How you correct (recast only):
- When the user makes a grammar or wording mistake, NEVER point it out or explain grammar. Instead, naturally weave the correct form into your reply (e.g. user: "It go very well" → you: "Oh nice, it went well? That's awesome!"). At most one recast per reply, keep it invisible.

Rules:
- Speak ONLY English, even if the user mixes in Chinese. If they write Chinese, understand it and respond to the meaning in natural English.
- Never lecture, never list "learning points", never use markdown formatting.
- You are a friend, not an assistant: don't offer services, don't say "How can I help you".
- If directly asked whether you are an AI, answer honestly, then steer back to the chat.`;

// ====== 难度块 ======

const LEVEL_GUIDE: Record<CEFRLevel, string> = {
  A1: "Use very short sentences (max 8 words), the 500 most common words, mostly present tense. Ask simple yes/no or either/or questions.",
  A2: "Use short, simple sentences and common everyday words. Basic connectors (and, but, because). Ask simple direct questions.",
  B1: "Use everyday conversational English with some compound sentences. Common phrasal verbs are fine. Ask open questions about opinions and experiences.",
  B2: "Use natural conversational English, common idioms and phrasal verbs. Occasionally introduce a richer expression, but keep it accessible.",
  C1: "Use fluent, native-style English with idioms, nuance and humor. Feel free to use sophisticated vocabulary.",
  C2: "Use unrestricted native English — rich vocabulary, cultural references, wordplay.",
};

// ====== 语伴对话 system prompt ======

export interface CompanionPromptInput {
  topic: TopicCard;
  level: CEFRLevel;
  facts: MemoryFact[];
}

/**
 * 构建语伴对话的 system prompt
 *
 * 记忆注入策略：按 lastSeenAt 最近优先取 MAX_INJECT_FACTS 条，
 * 注入时按时间正序排列（最新的事实离对话最近，显著性更高）。
 */
export function buildCompanionSystemPrompt(
  input: CompanionPromptInput
): string {
  const blocks: string[] = [
    PERSONA_BLOCK,
    `The user's English level is ${input.level} (CEFR). Calibrate your English strictly:\n${LEVEL_GUIDE[input.level]}`,
    `Today's conversation topic: ${input.topic.titleEn} (${input.topic.titleZh}). Stay around this topic unless the user drifts elsewhere — follow their lead.`,
  ];

  if (input.facts.length > 0) {
    const selected = [...input.facts]
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .slice(0, MAX_INJECT_FACTS)
      .reverse();
    const lines = selected.map((f) => `- ${f.text}`).join("\n");
    blocks.push(
      `What you remember about the user from past conversations:\n${lines}`
    );
  }

  blocks.push(
    "Reply with plain conversational text only — no lists, no markdown, no stage directions."
  );
  return blocks.join("\n\n");
}

// ====== 对话转录（hint / summary 共用） ======

/** 把会话历史转成 "User:/Echo:" 文本，超出 maxTurns 保留最近轮次 */
export function buildTranscript(
  turns: CompanionChatTurn[],
  maxTurns = 40
): string {
  return turns
    .slice(-maxTurns)
    .map((t) => `${t.role === "user" ? "User" : "Echo"}: ${t.content}`)
    .join("\n");
}

// ====== 换一批话题 ======

const TOPICS_SYSTEM_TEMPLATE = `You suggest conversation topics for an English learner at CEFR {{level}}. Return ONLY a JSON array of exactly 5 objects:
[{"titleZh": "...", "titleEn": "...", "openerEn": "..."}]
- titleZh: 2~8 个汉字的生活化话题名
- titleEn: a short English title (2-5 words)
- openerEn: one casual opening question a friend would ask about the topic, strictly at the learner's level
Topics must be everyday and personal — easy to talk about without expertise (daily life, food, hobbies, work, travel, entertainment, memories...). No politics, no controversial topics, no duplicates of the excluded titles.`;

export function buildTopicsPrompts(input: {
  level: CEFRLevel;
  exclude: string[];
  facts: MemoryFact[];
}): { system: string; user: string } {
  const factsLine =
    input.facts.length > 0
      ? `Things you know about the learner: ${input.facts
          .slice(0, MAX_INJECT_FACTS)
          .map((f) => f.text)
          .join("; ")}. You may base 1-2 topics on these.`
      : "No known facts about the learner yet.";
  return {
    system: TOPICS_SYSTEM_TEMPLATE.replace("{{level}}", input.level),
    user:
      `Excluded titles (do not repeat): ${input.exclude.join(", ") || "(none)"}\n` +
      `${factsLine}\nGenerate 5 fresh topics now.`,
  };
}

// ====== 帮我说一句 ======

const HINT_SYSTEM_TEMPLATE = `You help an English learner (CEFR {{level}}) keep a friendly conversation going. Based on the conversation so far, suggest exactly 2 short example replies the learner could say next. They must be natural, spoken-style, level-appropriate, 1-2 sentences each, and take different angles. Return ONLY a JSON array: [{"en": "...", "zh": "..."}], where zh 是对应英文的中文意思。No other text.`;

export function buildHintPrompts(input: {
  turns: CompanionChatTurn[];
  topic: TopicCard;
  level: CEFRLevel;
}): { system: string; user: string } {
  return {
    system: HINT_SYSTEM_TEMPLATE.replace("{{level}}", input.level),
    user:
      `Topic: ${input.topic.titleEn}\n` +
      `Conversation so far:\n${buildTranscript(input.turns, 10)}\n\n` +
      `Suggest the 2 example replies now.`,
  };
}

/**
 * 解析 hint 响应：容错提取 JSON 数组，过滤非法项，最多保留 2 条。
 * 完全无法解析时返回空数组（由调用方提示重试）。
 */
export function parseHintsResponse(raw: string): CompanionHint[] {
  try {
    const parsed: unknown = JSON.parse(extractJsonText(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is CompanionHint =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as CompanionHint).en === "string" &&
          typeof (item as CompanionHint).zh === "string" &&
          (item as CompanionHint).en.trim().length > 0
      )
      .slice(0, 2);
  } catch {
    return [];
  }
}

// ====== 课后总结 + 记忆提炼 ======

const SUMMARY_SYSTEM_TEMPLATE = `You are reviewing an English practice conversation between "Echo" (an AI friend) and a learner (CEFR {{level}}). Be warm and encouraging, like a friend who noticed their progress.
Return ONLY JSON with this exact shape:
{
  "fluencyComment": "1-2 句朋友口吻的中文整体点评，先肯定再轻轻点出一个方向",
  "highlights": [{"en": "...", "note": "..."}],
  "improvements": [{"original": "...", "better": "...", "note": "..."}],
  "memoryUpdate": {"add": ["..."], "remove": ["..."]}
}
Rules:
- highlights: 2-3 expressions the learner used well. en 是用户说过的原句或短语，note 用中文简注好在哪里。
- improvements: 2-3 most valuable upgrades. original 是用户的原句，better 是自然地道的英文说法，note 用中文一句话说明差异。不要变成语法课。
- memoryUpdate.add: long-term facts about the USER worth remembering for future chats (job, projects, hobbies, plans, preferences, people they mentioned). Short third-person English sentences, max 5. Only facts explicitly revealed in THIS conversation.
- memoryUpdate.remove: pick from the provided old facts list — ones contradicted or outdated by this conversation. Copy the old fact text exactly. Empty array if none.
- If nothing is worth remembering, return empty arrays. Never invent facts.`;

export function buildSummaryPrompts(input: {
  turns: CompanionChatTurn[];
  topic: TopicCard;
  level: CEFRLevel;
  facts: MemoryFact[];
}): { system: string; user: string } {
  const factsJson =
    input.facts.length > 0
      ? JSON.stringify(input.facts.map((f) => f.text))
      : "(none)";
  return {
    system: SUMMARY_SYSTEM_TEMPLATE.replace("{{level}}", input.level),
    user:
      `Old facts about the user: ${factsJson}\n` +
      `Topic: ${input.topic.titleEn}\n` +
      `Conversation:\n${buildTranscript(input.turns)}\n\n` +
      `Produce the review JSON now.`,
  };
}
