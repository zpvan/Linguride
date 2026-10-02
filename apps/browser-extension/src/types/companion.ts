/**
 * @file companion.ts
 * @description 「语伴」英文对话功能的协议与数据传输类型定义
 *
 * 定义语伴页面与 Background 之间 Port 流式协议、
 * 一次性消息载荷，以及历史/收藏/记忆的存储结构。
 *
 * @author Lingride Team
 * @since 1.1.0
 */

import { CEFRLevel } from "./difficulty";

/** 语伴 Port 名称（页面与 Background 的流式通道） */
export const COMPANION_PORT_NAME = "companion-chat";

/** 发送给 LLM 的会话历史滑动窗口大小（条） */
export const COMPANION_HISTORY_WINDOW = 20;

/** 生成课后总结卡所需的最少用户消息条数 */
export const MIN_SUMMARY_USER_TURNS = 4;

/** 对话中的一轮（页面侧；system 由 Background 注入，页面不出现） */
export interface CompanionChatTurn {
  role: "user" | "assistant";
  content: string;
  /** 开场指令等 UI 不展示的历史轮次 */
  hidden?: boolean;
}

/** 话题卡 */
export interface TopicCard {
  id: string;
  /** 中文话题名（2-8 字） */
  titleZh: string;
  /** 英文话题名 */
  titleEn: string;
  /** 英文引子句（卡片上展示的 opening question） */
  openerEn: string;
}

/** 记忆事实（AI 提炼的关于用户的长期信息） */
export interface MemoryFact {
  text: string;
  createdAt: number;
  lastSeenAt: number;
}

/** 总结卡：用得好的表达 */
export interface SummaryHighlight {
  en: string;
  /** 中文简注：好在哪里 */
  note: string;
}

/** 总结卡：可改进的表达 */
export interface SummaryImprovement {
  original: string;
  better: string;
  /** 中文简释差异 */
  note: string;
}

/** 课后总结卡 */
export interface SummaryCard {
  /** 朋友口吻的中文整体点评 */
  fluencyComment: string;
  highlights: SummaryHighlight[];
  improvements: SummaryImprovement[];
}

/** 「帮我说一句」提示 */
export interface CompanionHint {
  en: string;
  /** 中文意思 */
  zh: string;
}

/** 收藏项（亮点/改进一键收藏） */
export interface FavoriteItem {
  id: string;
  type: "highlight" | "improvement";
  en: string;
  note: string;
  /** type 为 improvement 时的地道说法 */
  better?: string;
  sourceTopic: string;
  savedAt: number;
}

/** 存储到历史的单轮（带时间戳） */
export interface CompanionStoredTurn extends CompanionChatTurn {
  ts: number;
}

/** 历史会话记录 */
export interface CompanionSession {
  id: string;
  topic: TopicCard;
  level: CEFRLevel;
  messages: CompanionStoredTurn[];
  summary?: SummaryCard;
  endedAt: number;
}

// ====== Port 协议（仅流式通道） ======

/** 页面 → Background */
export type CompanionPortRequest =
  | {
      type: "CHAT_TURN";
      requestId: string;
      /** 已截断的会话历史（最近 COMPANION_HISTORY_WINDOW 条） */
      history: CompanionChatTurn[];
      topic: TopicCard;
      level: CEFRLevel;
    }
  | { type: "CANCEL_STREAM"; requestId: string };

/** Background → 页面 */
export type CompanionPortEvent =
  | { type: "STREAM_START"; requestId: string }
  | { type: "STREAM_CHUNK"; requestId: string; delta: string }
  | { type: "STREAM_DONE"; requestId: string; fullText: string }
  | { type: "STREAM_ERROR"; requestId: string; message: string };

/**
 * 构建开场指令（隐藏的首条 user 消息，不在 UI 展示）
 *
 * 放在协议模块：页面用它记录隐藏历史轮次，保证发给
 * Background 的历史以 user 开头（Anthropic 格式要求）。
 */
export function buildOpeningUserInstruction(topic: TopicCard): string {
  return (
    `(OOC: Start the conversation now. Greet the user like an old friend ` +
    `you haven't seen for a few days, and naturally bring up the topic ` +
    `"${topic.titleEn}". If you remember something relevant about the ` +
    `user, reference it warmly.)`
  );
}
