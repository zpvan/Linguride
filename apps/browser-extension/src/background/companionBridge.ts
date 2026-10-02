/**
 * @file companionBridge.ts
 * @description 「语伴」Background 桥接层：Port 流式通道 + 一次性消息 handler
 *
 * 设计要点：
 * - Background 无会话状态：页面每次 CHAT_TURN 携带截断后的全量历史，
 *   SW 休眠/重启不丢对话
 * - system prompt（人格/难度/记忆）在本层构建，AI 逻辑不出 Background
 * - 所有可测逻辑在 companionPrompts/Memory/Topics/Summary 模块，
 *   本层只做编排（薄层，遵循 service-worker 既有 handler 惯例）
 *
 * @author Lingride Team
 * @since 1.1.0
 */

import { ITranslateProvider } from "../providers";
import { CEFRLevel, LingridConfig } from "../types";
import {
  COMPANION_PORT_NAME,
  CompanionChatTurn,
  CompanionPortEvent,
  CompanionPortRequest,
  TopicCard,
} from "../types/companion";
import {
  BaseResponse,
  EndCompanionSessionResponse,
  GenerateCompanionTopicsResponse,
  GetCompanionMemoryResponse,
  RequestCompanionHintResponse,
} from "../types/messages";
import {
  applyMemoryUpdate,
  clearCompanionMemory,
  loadMemoryFacts,
  saveMemoryFacts,
} from "./companionMemory";
import {
  buildCompanionSystemPrompt,
  buildHintPrompts,
  buildSummaryPrompts,
  buildTopicsPrompts,
  parseHintsResponse,
} from "./companionPrompts";
import { parseSummaryResponse } from "./companionSummary";
import { parseTopicsResponse, pickPresetTopics } from "./companionTopics";

/** Bridge 依赖：由 service-worker 注入，复用其配置加载与 provider 装配 */
export interface CompanionBridgeDeps {
  prepareAIProvider: () => Promise<{
    config: LingridConfig;
    provider: ITranslateProvider;
  }>;
}

type GenerateTopicsPayload = {
  level: CEFRLevel;
  exclude: string[];
};

type ChatPayload = {
  history: CompanionChatTurn[];
  topic: TopicCard;
  level: CEFRLevel;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 归一化页面历史为 LLM 可用的消息序列
 *
 * Anthropic Messages 格式（MiniMax）强制 role 交替且首条为 user：
 * - 合并连续同 role 轮次（流式失败后用户直接再发会产生连续 user）
 * - 丢弃窗口前导 assistant 轮次（滑动窗口截断可能造成）
 * - hidden 轮次保留（OOC 开场指令仍是对话上下文）
 */
export function normalizeChatTurns(
  turns: CompanionChatTurn[]
): CompanionChatTurn[] {
  const merged: CompanionChatTurn[] = [];
  for (const turn of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) {
      last.content = `${last.content}\n${turn.content}`;
    } else {
      merged.push({ ...turn });
    }
  }
  // 丢弃前导 assistant 轮次
  while (merged.length > 0 && merged[0].role === "assistant") {
    merged.shift();
  }
  return merged;
}

// ====== Port 流式通道 ======

/** 进行中的流式请求（requestId → AbortController），供 CANCEL_STREAM 中止 */
const activeStreams = new Map<string, AbortController>();

/**
 * 注册语伴 Port 监听（service-worker 启动时调用一次）
 *
 * MV3 注意：Port 连接期间的消息活动会重置 SW 空闲计时器；
 * 页面关闭/断开时，按 port 追踪的请求集合批量 abort 进行中的流，
 * 避免标签页已消失还继续消耗 LLM 配额。
 */
export function registerCompanionPort(deps: CompanionBridgeDeps): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== COMPANION_PORT_NAME) return;

    // 本 port 上进行中（尚未完结）的流式请求
    const portRequestIds = new Set<string>();

    port.onMessage.addListener((raw: CompanionPortRequest) => {
      if (raw.type === "CHAT_TURN") {
        portRequestIds.add(raw.requestId);
        void handleChatTurn(deps, port, raw).finally(() => {
          portRequestIds.delete(raw.requestId);
        });
      } else if (raw.type === "CANCEL_STREAM") {
        activeStreams.get(raw.requestId)?.abort();
      }
    });

    port.onDisconnect.addListener(() => {
      for (const requestId of portRequestIds) {
        activeStreams.get(requestId)?.abort();
      }
      portRequestIds.clear();
    });
  });
}

async function handleChatTurn(
  deps: CompanionBridgeDeps,
  port: chrome.runtime.Port,
  request: Extract<CompanionPortRequest, { type: "CHAT_TURN" }>
): Promise<void> {
  const { requestId, history, topic, level } = request;
  const post = (event: CompanionPortEvent): void => {
    try {
      port.postMessage(event);
    } catch {
      // 页面已关闭，丢弃事件
    }
  };

  const controller = new AbortController();
  activeStreams.set(requestId, controller);
  try {
    const { provider } = await deps.prepareAIProvider();
    const facts = await loadMemoryFacts();
    const systemPrompt = buildCompanionSystemPrompt({ topic, level, facts });

    post({ type: "STREAM_START", requestId });
    const fullText = await provider.chatStream(
      [
        { role: "system", content: systemPrompt },
        ...normalizeChatTurns(history),
      ],
      (delta) => post({ type: "STREAM_CHUNK", requestId, delta }),
      controller.signal
    );
    post({ type: "STREAM_DONE", requestId, fullText });
  } catch (error) {
    const message = controller.signal.aborted
      ? "回复已取消或超时，点击重试"
      : errorMessage(error);
    post({ type: "STREAM_ERROR", requestId, message });
  } finally {
    activeStreams.delete(requestId);
  }
}

// ====== 一次性消息 handler ======

/**
 * 换一批话题：AI 生成失败时回退预设库（fromPreset 标记）
 */
export async function handleGenerateCompanionTopics(
  deps: CompanionBridgeDeps,
  payload: GenerateTopicsPayload
): Promise<GenerateCompanionTopicsResponse> {
  try {
    const { provider } = await deps.prepareAIProvider();
    const facts = await loadMemoryFacts();
    const prompts = buildTopicsPrompts({
      level: payload.level,
      exclude: payload.exclude,
      facts,
    });
    const raw = await provider.chat(prompts.system, prompts.user);
    const topics = parseTopicsResponse(raw);
    return { success: true, data: { topics, fromPreset: false } };
  } catch (error) {
    console.warn(
      "[Lingride] 语伴话题 AI 生成失败，回退预设库:",
      errorMessage(error)
    );
    return {
      success: true,
      data: {
        topics: pickPresetTopics(payload.exclude, 5),
        fromPreset: true,
      },
    };
  }
}

/**
 * 帮我说一句：生成 1-2 句示例回复
 */
export async function handleRequestCompanionHint(
  deps: CompanionBridgeDeps,
  payload: ChatPayload
): Promise<RequestCompanionHintResponse> {
  try {
    const { provider } = await deps.prepareAIProvider();
    const prompts = buildHintPrompts({
      turns: payload.history,
      topic: payload.topic,
      level: payload.level,
    });
    const raw = await provider.chat(prompts.system, prompts.user);
    const hints = parseHintsResponse(raw);
    if (hints.length === 0) {
      return { success: false, error: "提示生成失败，请重试" };
    }
    return { success: true, data: { hints } };
  } catch (error) {
    console.error("[Lingride] 语伴提示生成失败:", errorMessage(error));
    return { success: false, error: errorMessage(error) };
  }
}

/**
 * 结束对话：生成总结卡，同时应用记忆增量（不转发给页面）
 */
export async function handleEndCompanionSession(
  deps: CompanionBridgeDeps,
  payload: ChatPayload
): Promise<EndCompanionSessionResponse> {
  try {
    const { provider } = await deps.prepareAIProvider();
    const facts = await loadMemoryFacts();
    const prompts = buildSummaryPrompts({
      turns: payload.history,
      topic: payload.topic,
      level: payload.level,
      facts,
    });
    const raw = await provider.chat(prompts.system, prompts.user);
    const parsed = parseSummaryResponse(raw);

    const merged = applyMemoryUpdate(facts, parsed.memoryUpdate, Date.now());
    await saveMemoryFacts(merged);
    console.log(
      `[Lingride] 语伴记忆更新：+${parsed.memoryUpdate.add.length} -${parsed.memoryUpdate.remove.length}，共 ${merged.length} 条`
    );

    return { success: true, data: { summary: parsed.summary } };
  } catch (error) {
    console.error("[Lingride] 语伴总结生成失败:", errorMessage(error));
    return { success: false, error: errorMessage(error) };
  }
}

/**
 * 获取语伴记忆（设置/调试用）
 */
export async function handleGetCompanionMemory(): Promise<GetCompanionMemoryResponse> {
  try {
    const facts = await loadMemoryFacts();
    return { success: true, data: { facts } };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}

/**
 * 清除语伴记忆
 */
export async function handleClearCompanionMemory(): Promise<BaseResponse> {
  try {
    await clearCompanionMemory();
    return { success: true };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}
