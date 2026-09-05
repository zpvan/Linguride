import { describe, expect, it, vi } from "vitest";

import { summarizeDiagnoseSamples, withTimeout } from "./ttsDiagnostics";

describe("summarizeDiagnoseSamples", () => {
  it("aggregates successful samples", () => {
    const summary = summarizeDiagnoseSamples([
      { success: true, durationMs: 2000 },
      { success: true, durationMs: 4000 },
      { success: true, durationMs: 9000 },
    ]);

    expect(summary).toEqual({
      successCount: 3,
      totalCount: 3,
      avgMs: 5000,
      minMs: 2000,
      maxMs: 9000,
      failures: [],
    });
  });

  it("groups failures by errorCode", () => {
    const summary = summarizeDiagnoseSamples([
      { success: true, durationMs: 3000 },
      { success: false, durationMs: 1000, errorCode: "TTS_RATE_LIMIT" },
      { success: false, durationMs: 1200, errorCode: "TTS_RATE_LIMIT" },
      { success: false, durationMs: 800, errorCode: "TTS_AUTH_ERROR" },
    ]);

    expect(summary.successCount).toBe(1);
    expect(summary.totalCount).toBe(4);
    expect(summary.avgMs).toBe(3000);
    expect(summary.failures).toEqual([
      { errorCode: "TTS_RATE_LIMIT", count: 2 },
      { errorCode: "TTS_AUTH_ERROR", count: 1 },
    ]);
  });

  it("returns zero latency stats when all samples failed", () => {
    const summary = summarizeDiagnoseSamples([
      { success: false, durationMs: 500, errorCode: "TTS_NETWORK_ERROR" },
    ]);

    expect(summary.avgMs).toBe(0);
    expect(summary.minMs).toBe(0);
    expect(summary.maxMs).toBe(0);
  });
});

describe("withTimeout", () => {
  it("resolves when the promise settles in time", async () => {
    const result = await withTimeout(
      Promise.resolve("ok"),
      1000,
      () => new Error("timeout")
    );
    expect(result).toBe("ok");
  });

  it("rejects with the timeout error when the promise is too slow", async () => {
    vi.useFakeTimers();
    const slow = new Promise<string>((resolve) =>
      setTimeout(() => resolve("late"), 5000)
    );
    const assertion = expect(
      withTimeout(slow, 1000, () => new Error("诊断采样超时"))
    ).rejects.toThrow("诊断采样超时");
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    vi.useRealTimers();
  });
});
