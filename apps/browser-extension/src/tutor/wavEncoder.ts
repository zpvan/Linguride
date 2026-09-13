/**
 * @file wavEncoder.ts
 * @description 16kHz/mono/int16 PCM → 44 字节 RIFF WAV 头编码。
 *
 * 供批量上传式 ASR 识别器（小米 / MiniMax）共用。
 */

/**
 * 把 16kHz/mono/int16 PCM 包上 44 字节 RIFF WAV 头。
 */
export function encodeWavFromPCM(pcm: Int16Array): Uint8Array {
  const dataLength = pcm.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt 块长度
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 16000, true); // 采样率
  view.setUint32(28, 16000 * 2, true); // 字节率 = rate * channels * bits/8
  view.setUint16(32, 2, true); // 块对齐 = channels * bits/8
  view.setUint16(34, 16, true); // 位深
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  new Int16Array(buffer, 44).set(pcm);
  return new Uint8Array(buffer);
}
