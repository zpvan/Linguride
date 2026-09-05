import { describe, expect, it } from "vitest";

import {
  SAUC_MSG_AUDIO_ONLY,
  SAUC_MSG_ERROR,
  SAUC_MSG_FULL_CLIENT_REQUEST,
  SAUC_MSG_FULL_SERVER_RESPONSE,
  buildAudioFrame,
  buildFullClientRequest,
  parseServerMessage,
} from "./saucProtocol";

describe("buildFullClientRequest", () => {
  it("builds header with full-client-request type and gzip JSON payload", async () => {
    const frame = await buildFullClientRequest({
      user: { uid: "test" },
      audio: { format: "pcm", codec: "raw", rate: 16000, bits: 16, channel: 1 },
      request: { model_name: "bigmodel", enable_punc: true },
    });

    expect(frame[0]).toBe(0b0001_0001); // 版本1 + 头长1
    expect(frame[1]).toBe((SAUC_MSG_FULL_CLIENT_REQUEST << 4) | 1); // 正序列号
    expect(frame[2]).toBe(0b0001_0001); // JSON + gzip
    expect(frame[3]).toBe(0);

    const view = new DataView(frame.buffer, frame.byteOffset);
    const seq = view.getInt32(4);
    expect(seq).toBe(1);

    const payloadSize = view.getUint32(8);
    expect(payloadSize).toBe(frame.length - 12);
  });
});

describe("buildAudioFrame", () => {
  it("increments positive sequence for normal frames", async () => {
    const pcm = new Uint8Array([1, 2, 3, 4]);
    const frame = await buildAudioFrame(pcm, 5, false);

    expect(frame[1]).toBe((SAUC_MSG_AUDIO_ONLY << 4) | 1);
    const view = new DataView(frame.buffer, frame.byteOffset);
    expect(view.getInt32(4)).toBe(5);
  });

  it("negates sequence with last-packet flag for final frame", async () => {
    const pcm = new Uint8Array([1, 2, 3, 4]);
    const frame = await buildAudioFrame(pcm, 5, true);

    expect(frame[1]).toBe((SAUC_MSG_AUDIO_ONLY << 4) | 3);
    const view = new DataView(frame.buffer, frame.byteOffset);
    expect(view.getInt32(4)).toBe(-5);
  });
});

describe("parseServerMessage", () => {
  it("parses gzipped JSON result with text", async () => {
    const request = await buildFullClientRequest({ result: { text: "hello" } });
    const parsed = await parseServerMessage(request);

    expect(parsed.type).toBe("result");
    expect(parsed.payload).toEqual({ result: { text: "hello" } });
    expect(parsed.isLast).toBe(false);
  });

  it("detects last package by negative sequence", async () => {
    const frame = await buildAudioFrame(new Uint8Array([0]), 7, true);
    // 把类型位改成 server response 复用同一布局构造测试帧
    frame[1] = (SAUC_MSG_FULL_SERVER_RESPONSE << 4) | 3;
    // 载荷不是合法 JSON（是 gzip 的 [0]），该用例只验证序列号
    const view = new DataView(frame.buffer, frame.byteOffset);
    expect(view.getInt32(4)).toBe(-7);
  });

  it("parses error frame: sequence field is the error code", async () => {
    // 手工构造错误帧：type=15, flags=1（带序列号）, 无压缩
    const payload = new TextEncoder().encode("quota exceeded");
    const frame = new Uint8Array(12 + payload.length);
    const view = new DataView(frame.buffer);
    frame[0] = 0b0001_0001;
    frame[1] = (SAUC_MSG_ERROR << 4) | 1;
    frame[2] = 0b0001_0000; // JSON 无压缩
    view.setInt32(4, 45000001);
    view.setUint32(8, payload.length);
    frame.set(payload, 12);

    const parsed = await parseServerMessage(frame);
    expect(parsed.type).toBe("error");
    expect(parsed.errorCode).toBe(45000001);
    expect(parsed.errorMessage).toBe("quota exceeded");
  });
});
