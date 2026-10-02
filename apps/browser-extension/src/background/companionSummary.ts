/**
 * @file companionSummary.ts
 * @description 「语伴」课后总结卡 + 记忆提炼的容错解析
 *
 * 结束对话时由 companionBridge 调 LLM 一次性产出
 * （fluencyComment / highlights / improvements / memoryUpdate），
 * 本模块负责把原始输出解析为结构化结果。
 * 解析策略：永不抛错——JSON 失败时回退为纯文本点评，
 * 保证用户结束对话一定有正向反馈。
 *
 * @author Lingride Team
 * @since 1.1.0
 */

import { SummaryCard, SummaryHighlight, SummaryImprovement } from "../types/companion";
import { extractJsonText } from "./aiJsonExtract";

/** 解析结果：总结卡 + 记忆增量（由调用方应用到记忆存储） */
export interface ParsedCompanionSummary {
  summary: SummaryCard;
  memoryUpdate: { add: string[]; remove: string[] };
}

const MAX_HIGHLIGHTS = 3;
const MAX_IMPROVEMENTS = 3;
const MAX_MEMORY_ADD = 5;
/** remove 列表不截断事实条数本身，给个宽松上限防异常输出 */
const MAX_MEMORY_FACTS_LIMIT = 30;
const DEFAULT_COMMENT = "本次对话已结束——每次开口都是进步，下次继续聊！";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseHighlights(raw: unknown): SummaryHighlight[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is SummaryHighlight =>
        typeof item === "object" &&
        item !== null &&
        isNonEmptyString((item as SummaryHighlight).en) &&
        typeof (item as SummaryHighlight).note === "string"
    )
    .slice(0, MAX_HIGHLIGHTS);
}

function parseImprovements(raw: unknown): SummaryImprovement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is SummaryImprovement =>
        typeof item === "object" &&
        item !== null &&
        isNonEmptyString((item as SummaryImprovement).original) &&
        isNonEmptyString((item as SummaryImprovement).better) &&
        typeof (item as SummaryImprovement).note === "string"
    )
    .slice(0, MAX_IMPROVEMENTS);
}

function parseStringList(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isNonEmptyString).slice(0, max);
}

/**
 * 解析总结响应（永不抛错）
 *
 * 1. 尝试提取 JSON 并校验字段（缺失给默认值）
 * 2. 完全失败时把原文作为纯文本点评返回
 */
export function parseSummaryResponse(raw: string): ParsedCompanionSummary {
  const fallback: ParsedCompanionSummary = {
    summary: {
      fluencyComment: raw.trim().slice(0, 300) || DEFAULT_COMMENT,
      highlights: [],
      improvements: [],
    },
    memoryUpdate: { add: [], remove: [] },
  };

  try {
    const parsed = JSON.parse(extractJsonText(raw)) as Record<string, unknown>;
    if (typeof parsed !== "object" || parsed === null) return fallback;

    const memoryRaw = (parsed.memoryUpdate ?? {}) as Record<string, unknown>;
    return {
      summary: {
        fluencyComment: isNonEmptyString(parsed.fluencyComment)
          ? parsed.fluencyComment
          : DEFAULT_COMMENT,
        highlights: parseHighlights(parsed.highlights),
        improvements: parseImprovements(parsed.improvements),
      },
      memoryUpdate: {
        add: parseStringList(memoryRaw.add, MAX_MEMORY_ADD),
        remove: parseStringList(memoryRaw.remove, MAX_MEMORY_FACTS_LIMIT),
      },
    };
  } catch {
    return fallback;
  }
}
