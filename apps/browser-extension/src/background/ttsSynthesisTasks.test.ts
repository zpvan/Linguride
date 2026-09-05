import { describe, expect, it } from "vitest";

import { TTSSynthesisTaskRegistry } from "./ttsSynthesisTasks";

describe("TTSSynthesisTaskRegistry", () => {
  it("begins a task in submitting stage", () => {
    const registry = new TTSSynthesisTaskRegistry(() => 1000);
    registry.begin("req-1");

    const record = registry.get("req-1");
    expect(record?.stage).toBe("submitting");
    expect(record?.startedAt).toBe(1000);
  });

  it("advances stages and records taskId", () => {
    const registry = new TTSSynthesisTaskRegistry(() => 1000);
    registry.begin("req-1");
    registry.advance("req-1", "synthesizing", { taskId: 12345 });
    registry.advance("req-1", "downloading");

    const record = registry.get("req-1");
    expect(record?.stage).toBe("downloading");
    expect(record?.taskId).toBe(12345);
  });

  it("marks terminal stage timestamps on finish", () => {
    let now = 1000;
    const registry = new TTSSynthesisTaskRegistry(() => now);
    registry.begin("req-1");
    now = 5000;
    registry.advance("req-1", "ready");

    expect(registry.get("req-1")?.finishedAt).toBe(5000);
  });

  it("fail records errorCode and does not overwrite cancelled tasks", () => {
    const registry = new TTSSynthesisTaskRegistry(() => 1000);
    registry.begin("req-1");
    registry.cancel("req-1");
    registry.fail("req-1", "TTS_RATE_LIMIT");

    const record = registry.get("req-1");
    expect(record?.stage).toBe("cancelled");
    expect(record?.errorCode).toBeUndefined();
  });

  it("fail marks stage failed with errorCode", () => {
    const registry = new TTSSynthesisTaskRegistry(() => 1000);
    registry.begin("req-1");
    registry.fail("req-1", "TTS_RATE_LIMIT");

    const record = registry.get("req-1");
    expect(record?.stage).toBe("failed");
    expect(record?.errorCode).toBe("TTS_RATE_LIMIT");
  });

  it("returns undefined for unknown requestId", () => {
    const registry = new TTSSynthesisTaskRegistry();
    expect(registry.get("missing")).toBeUndefined();
  });

  it("isolates concurrent requestIds", () => {
    const registry = new TTSSynthesisTaskRegistry(() => 1000);
    registry.begin("req-1");
    registry.begin("req-2");
    registry.advance("req-1", "synthesizing");

    expect(registry.get("req-1")?.stage).toBe("synthesizing");
    expect(registry.get("req-2")?.stage).toBe("submitting");
  });

  it("prunes terminal tasks after retention window", () => {
    let now = 1000;
    const registry = new TTSSynthesisTaskRegistry(() => now);
    registry.begin("req-1");
    registry.advance("req-1", "ready");

    now += 5 * 60 * 1000 + 1;
    expect(registry.get("req-1")).toBeUndefined();
  });

  it("keeps terminal tasks within retention window", () => {
    let now = 1000;
    const registry = new TTSSynthesisTaskRegistry(() => now);
    registry.begin("req-1");
    registry.advance("req-1", "ready");

    now += 5 * 60 * 1000 - 1;
    expect(registry.get("req-1")?.stage).toBe("ready");
  });

  it("does not prune active tasks", () => {
    let now = 1000;
    const registry = new TTSSynthesisTaskRegistry(() => now);
    registry.begin("req-1");

    now += 60 * 60 * 1000;
    expect(registry.get("req-1")?.stage).toBe("submitting");
  });
});
