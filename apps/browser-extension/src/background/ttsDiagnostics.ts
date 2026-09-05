/**
 * @file ttsDiagnostics.ts
 * @description TTS 深度诊断：采样结果聚合与超时包装（纯函数，便于测试）
 */

import type { TTSDiagnoseSummary, TTSServiceErrorCode } from "../types/messages";

export interface DiagnoseSampleResult {
  /** 本次采样是否成功 */
  success: boolean;
  /** 采样耗时（毫秒） */
  durationMs: number;
  /** 失败时的错误码 */
  errorCode?: TTSServiceErrorCode;
}

/**
 * 聚合多次采样结果：成功率、耗时统计（仅统计成功样本）、失败原因分布。
 */
export function summarizeDiagnoseSamples(
  samples: DiagnoseSampleResult[]
): TTSDiagnoseSummary {
  const successes = samples.filter((sample) => sample.success);
  const durations = successes.map((sample) => sample.durationMs);

  const failureMap = new Map<TTSServiceErrorCode, number>();
  for (const sample of samples) {
    if (sample.success) continue;
    const code = sample.errorCode ?? "TTS_UNKNOWN_ERROR";
    failureMap.set(code, (failureMap.get(code) ?? 0) + 1);
  }

  return {
    successCount: successes.length,
    totalCount: samples.length,
    avgMs:
      durations.length > 0
        ? Math.round(durations.reduce((sum, v) => sum + v, 0) / durations.length)
        : 0,
    minMs: durations.length > 0 ? Math.min(...durations) : 0,
    maxMs: durations.length > 0 ? Math.max(...durations) : 0,
    failures: [...failureMap.entries()].map(([errorCode, count]) => ({
      errorCode,
      count,
    })),
  };
}

/**
 * 为 Promise 添加超时；超时后以 onTimeout 产生的错误拒绝。
 * 内部 Promise 被拒绝后仍可能 settle，附加 catch 避免未处理拒绝告警。
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => Error
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    promise.catch(() => {
      // 超时后内部 Promise 的后续拒绝不再有人消费，静默吞掉
    });
  }
}
