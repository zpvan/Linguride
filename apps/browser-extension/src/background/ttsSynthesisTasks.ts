/**
 * @file ttsSynthesisTasks.ts
 * @description AI 语音合成任务表：跟踪每次合成请求的阶段进度，支持取消与惰性清理
 */

import type { TTSServiceErrorCode, TTSSynthesisStage } from "../types/messages";

export interface TTSSynthesisTaskRecord {
  /** 合成进度跟踪 ID */
  requestId: string;
  /** 当前合成阶段 */
  stage: TTSSynthesisStage;
  /** MiniMax 异步任务 ID（创建任务成功后记录） */
  taskId?: number;
  /** 合成开始时间戳 */
  startedAt: number;
  /** 进入终态（ready/failed/cancelled）的时间戳 */
  finishedAt?: number;
  /** 失败错误码 */
  errorCode?: TTSServiceErrorCode;
}

/** 终态任务保留时长，供页面查询最终状态 */
const TERMINAL_RETENTION_MS = 5 * 60 * 1000;

const TERMINAL_STAGES: ReadonlySet<TTSSynthesisStage> = new Set([
  "ready",
  "failed",
  "cancelled",
]);

export class TTSSynthesisTaskRegistry {
  private readonly tasks = new Map<string, TTSSynthesisTaskRecord>();

  constructor(private readonly now: () => number = Date.now) {}

  /** 登记一次新的合成请求（submitting 阶段） */
  begin(requestId: string): void {
    this.tasks.set(requestId, {
      requestId,
      stage: "submitting",
      startedAt: this.now(),
    });
  }

  /** 推进阶段；终态任务不再变更 */
  advance(
    requestId: string,
    stage: TTSSynthesisStage,
    patch?: { taskId?: number }
  ): void {
    const record = this.tasks.get(requestId);
    if (!record || TERMINAL_STAGES.has(record.stage)) return;

    record.stage = stage;
    if (patch?.taskId !== undefined) {
      record.taskId = patch.taskId;
    }
    if (TERMINAL_STAGES.has(stage)) {
      record.finishedAt = this.now();
    }
  }

  /** 标记失败；不覆盖已进入终态（如已取消）的任务 */
  fail(requestId: string, errorCode: TTSServiceErrorCode): void {
    const record = this.tasks.get(requestId);
    if (!record || TERMINAL_STAGES.has(record.stage)) return;

    record.stage = "failed";
    record.errorCode = errorCode;
    record.finishedAt = this.now();
  }

  /** 取消合成；不覆盖已进入终态的任务 */
  cancel(requestId: string): void {
    const record = this.tasks.get(requestId);
    if (!record || TERMINAL_STAGES.has(record.stage)) return;

    record.stage = "cancelled";
    record.finishedAt = this.now();
  }

  /** 查询任务；惰性清理过期终态任务 */
  get(requestId: string): TTSSynthesisTaskRecord | undefined {
    this.pruneExpired();
    return this.tasks.get(requestId);
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [requestId, record] of this.tasks) {
      if (
        record.finishedAt !== undefined &&
        now - record.finishedAt > TERMINAL_RETENTION_MS
      ) {
        this.tasks.delete(requestId);
      }
    }
  }
}

/** 全局共享的合成任务表 */
export const ttsSynthesisTaskRegistry = new TTSSynthesisTaskRegistry();
