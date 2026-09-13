import { describe, expect, it } from "vitest";

import { encodeWavFromPCM } from "./wavEncoder";

describe("encodeWavFromPCM", () => {
  it("writes a valid 44-byte WAV header for 16kHz mono int16", () => {
    const pcm = new Int16Array([0, 1000, -1000, 32767, -32768]);
    const wav = encodeWavFromPCM(pcm);

    // RIFF 魔数
    expect(String.fromCharCode(wav[0], wav[1], wav[2], wav[3])).toBe("RIFF");
    expect(String.fromCharCode(wav[8], wav[9], wav[10], wav[11])).toBe("WAVE");
    // 文件总长 = 36 + 数据字节数
    const view = new DataView(wav.buffer);
    expect(view.getUint32(4, true)).toBe(36 + pcm.length * 2);
    // fmt: PCM=1, mono=1, 16kHz, 16bit
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    // data 块长度
    expect(view.getUint32(40, true)).toBe(pcm.length * 2);
    // 总长度
    expect(wav.length).toBe(44 + pcm.length * 2);
  });

  it("encodes PCM samples little-endian after the header", () => {
    const pcm = new Int16Array([0x0102]);
    const wav = encodeWavFromPCM(pcm);
    expect(wav[44]).toBe(0x02);
    expect(wav[45]).toBe(0x01);
  });
});
