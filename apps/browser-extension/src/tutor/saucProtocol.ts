/**
 * @file saucProtocol.ts
 * @description 火山引擎 SAUC v1 二进制协议编解码（豆包流式语音识别）
 *
 * 帧布局（大端序）：
 *   byte0: (protocol_version=1 << 4) | header_size=1（4 字节头）
 *   byte1: (message_type << 4) | flags
 *   byte2: (serialization << 4) | compression
 *   byte3: reserved = 0
 *   [flags ∈ {1,2,3} 时] int32 sequence
 *   uint32 payload_size
 *   payload（compression=1 时 gzip）
 */

export const SAUC_MSG_FULL_CLIENT_REQUEST = 0b0001;
export const SAUC_MSG_AUDIO_ONLY = 0b0010;
export const SAUC_MSG_FULL_SERVER_RESPONSE = 0b1001;
export const SAUC_MSG_SERVER_ACK = 0b1011;
export const SAUC_MSG_ERROR = 0b1111;

const FLAG_NO_SEQUENCE = 0b0000;
const FLAG_POS_SEQUENCE = 0b0001;
const FLAG_NEG_WITH_SEQUENCE = 0b0011;

const SERIALIZATION_JSON = 0b0001;
const COMPRESSION_GZIP = 0b0001;

async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
  // 注意：new Uint8Array(data) 复制出独立 ArrayBuffer（既是 BlobPart 类型要求，
  // 也避免 subarray 的共享 buffer 问题）
  const stream = new Blob([new Uint8Array(data)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(data)])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function buildHeader(
  messageType: number,
  flags: number,
  serialization: number,
  compression: number
): Uint8Array {
  return new Uint8Array([
    0b0001_0001,
    (messageType << 4) | flags,
    (serialization << 4) | compression,
    0,
  ]);
}

function assembleFrame(
  header: Uint8Array,
  sequence: number | null,
  payload: Uint8Array
): Uint8Array {
  const seqBytes = sequence !== null ? 4 : 0;
  const frame = new Uint8Array(header.length + seqBytes + 4 + payload.length);
  const view = new DataView(frame.buffer);

  frame.set(header, 0);
  let offset = header.length;
  if (sequence !== null) {
    view.setInt32(offset, sequence);
    offset += 4;
  }
  view.setUint32(offset, payload.length);
  frame.set(payload, offset + 4);

  return frame;
}

/** 构建 full client request（会话首包，seq=1，JSON+gzip） */
export async function buildFullClientRequest(
  config: Record<string, unknown>
): Promise<Uint8Array> {
  const payload = await gzipCompress(
    new TextEncoder().encode(JSON.stringify(config))
  );
  return assembleFrame(
    buildHeader(
      SAUC_MSG_FULL_CLIENT_REQUEST,
      FLAG_POS_SEQUENCE,
      SERIALIZATION_JSON,
      COMPRESSION_GZIP
    ),
    1,
    payload
  );
}

/** 构建音频帧；isLast 时序列号取负（最后一包） */
export async function buildAudioFrame(
  pcm: Uint8Array,
  sequence: number,
  isLast: boolean
): Promise<Uint8Array> {
  const payload = await gzipCompress(pcm);
  return assembleFrame(
    buildHeader(
      SAUC_MSG_AUDIO_ONLY,
      isLast ? FLAG_NEG_WITH_SEQUENCE : FLAG_POS_SEQUENCE,
      SERIALIZATION_JSON,
      COMPRESSION_GZIP
    ),
    isLast ? -sequence : sequence,
    payload
  );
}

export interface SaucServerMessage {
  type: "result" | "ack" | "error";
  /** 服务端序列号；< 0 表示最后一包 */
  sequence: number;
  /** 是否最后一包 */
  isLast: boolean;
  /** result 类型的 JSON 载荷 */
  payload?: unknown;
  /** error 类型的错误码（取 sequence 字段） */
  errorCode?: number;
  /** error 类型的错误消息 */
  errorMessage?: string;
}

/** 解析服务端帧 */
export async function parseServerMessage(
  frame: Uint8Array
): Promise<SaucServerMessage> {
  if (frame.length < 4) {
    throw new Error("SAUC 帧长度不足");
  }

  const headerSize = (frame[0] & 0x0f) * 4;
  const messageType = (frame[1] >> 4) & 0x0f;
  const flags = frame[1] & 0x0f;
  const compression = frame[2] & 0x0f;

  const view = new DataView(frame.buffer, frame.byteOffset);
  let offset = headerSize;

  let sequence = 0;
  if (flags !== FLAG_NO_SEQUENCE) {
    sequence = view.getInt32(offset);
    offset += 4;
  }

  const payloadSize = view.getUint32(offset);
  offset += 4;
  let payload = frame.subarray(offset, offset + payloadSize);
  if (compression === COMPRESSION_GZIP) {
    payload = await gzipDecompress(payload);
  }

  if (messageType === SAUC_MSG_ERROR) {
    return {
      type: "error",
      sequence,
      isLast: true,
      errorCode: sequence,
      errorMessage: new TextDecoder().decode(payload),
    };
  }

  if (messageType === SAUC_MSG_SERVER_ACK) {
    return { type: "ack", sequence, isLast: sequence < 0 };
  }

  const payloadText = new TextDecoder().decode(payload);
  return {
    type: "result",
    sequence,
    isLast: sequence < 0,
    payload: payloadText ? JSON.parse(payloadText) : undefined,
  };
}
