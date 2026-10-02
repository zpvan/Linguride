/**
 * @file chatController.ts
 * @description 「语伴」页面会话状态机（纯 TS，不碰 DOM）
 *
 * 职责：
 * - 持有会话历史（含隐藏的开场指令轮次）
 * - 流式回复的 pending 文本拼接与保护
 * - 发送前滑动窗口截断（控制 token 成本）
 * - 总结门槛判断（用户消息 ≥ MIN_SUMMARY_USER_TURNS，隐藏轮次不计入）
 *
 * @author Lingride Team
 * @since 1.1.0
 */

import {
  COMPANION_HISTORY_WINDOW,
  CompanionChatTurn,
  MIN_SUMMARY_USER_TURNS,
} from "../types/companion";

export class ChatController {
  private turns: CompanionChatTurn[] = [];
  private pendingText = "";
  private streaming = false;

  /** 记录一条用户消息（hidden 为 UI 不展示的开场指令等） */
  addUserTurn(content: string, options?: { hidden?: boolean }): void {
    this.turns.push({ role: "user", content, hidden: options?.hidden });
  }

  /** 开始一条助手流式回复（流式中重复调用抛错） */
  beginAssistantTurn(): void {
    if (this.streaming) {
      throw new Error("已有进行中的助手回复");
    }
    this.streaming = true;
    this.pendingText = "";
  }

  /** 追加流式增量文本（未 begin 时调用抛错） */
  appendAssistantDelta(delta: string): void {
    if (!this.streaming) {
      throw new Error("没有进行中的助手回复");
    }
    this.pendingText += delta;
  }

  /** 完成助手回复：写入历史并返回完整文本 */
  completeAssistantTurn(): string {
    const full = this.pendingText;
    this.turns.push({ role: "assistant", content: full });
    this.streaming = false;
    this.pendingText = "";
    return full;
  }

  /** 标记助手回复失败/中断：丢弃 pending，历史不变（用户轮次保留，可重试） */
  failAssistantTurn(): void {
    this.streaming = false;
    this.pendingText = "";
  }

  isStreaming(): boolean {
    return this.streaming;
  }

  getPendingText(): string {
    return this.pendingText;
  }

  /** 全部轮次（含隐藏） */
  getTurns(): CompanionChatTurn[] {
    return [...this.turns];
  }

  /** 可见轮次（渲染与历史回看用） */
  getVisibleTurns(): CompanionChatTurn[] {
    return this.turns.filter((t) => !t.hidden);
  }

  /** 发送给 LLM 的窗口截断历史 */
  getWindowedHistory(): CompanionChatTurn[] {
    return this.turns.slice(-COMPANION_HISTORY_WINDOW);
  }

  getUserTurnCount(): number {
    // 隐藏的开场指令不是"用户说的话"，不计入
    return this.turns.filter((t) => t.role === "user" && !t.hidden).length;
  }

  /** 是否满足生成总结卡的用户消息门槛 */
  canSummarize(): boolean {
    return this.getUserTurnCount() >= MIN_SUMMARY_USER_TURNS;
  }

  reset(): void {
    this.turns = [];
    this.pendingText = "";
    this.streaming = false;
  }
}
