/**
 * @file test-doubao-asr.ts
 * @description 豆包 ASR 端到端实测：ARK_API_KEY=xxx bun scripts/test-doubao-asr.ts <wav路径>
 * 用 Bun 的 WebSocket（支持自定义 header）直连 SAUC 接口。
 */
import {
  buildAudioFrame,
  buildFullClientRequest,
  parseServerMessage,
} from "../src/tutor/saucProtocol";

const apiKey = process.env.ARK_API_KEY?.trim();
const wavPath = process.argv[2];
if (!apiKey || !wavPath) {
  console.error(
    "用法: ARK_API_KEY=xxx bun scripts/test-doubao-asr.ts /tmp/asr-test.wav"
  );
  process.exit(2);
}

// 去掉 44 字节 WAV 头，得到裸 PCM
const wav = new Uint8Array(await Bun.file(wavPath).arrayBuffer());
const pcm = wav.subarray(44);

const ws = new WebSocket(
  "wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_nostream",
  {
    headers: {
      "X-Api-Key": apiKey,
      "X-Api-Resource-Id": "volc.seedasr.sauc.duration",
      "X-Api-Request-Id": crypto.randomUUID(),
    } as Record<string, string>,
  } as object
);
ws.binaryType = "arraybuffer";

let seq = 1;
ws.onopen = async () => {
  ws.send(
    await buildFullClientRequest({
      user: { uid: "test" },
      audio: { format: "pcm", codec: "raw", rate: 16000, bits: 16, channel: 1 },
      request: { model_name: "bigmodel", enable_punc: true },
    })
  );

  // 每 200ms 发一帧（200ms * 16000Hz * 2B = 6400 字节）
  const CHUNK = 6400;
  for (let offset = 0; offset < pcm.length; offset += CHUNK) {
    const isLast = offset + CHUNK >= pcm.length;
    ws.send(
      await buildAudioFrame(pcm.subarray(offset, offset + CHUNK), ++seq, isLast)
    );
    await Bun.sleep(200);
  }
};

ws.onmessage = async (event) => {
  if (!(event.data instanceof ArrayBuffer)) return;
  const message = await parseServerMessage(new Uint8Array(event.data));
  if (message.type === "error") {
    console.error(`✗ 错误 ${message.errorCode}: ${message.errorMessage}`);
    process.exit(1);
  }
  if (message.type === "result") {
    const text = (message.payload as { result?: { text?: string } })?.result
      ?.text;
    if (text) console.log("识别结果:", text);
  }
  if (message.isLast) {
    process.exit(0);
  }
};

ws.onerror = () => {
  console.error("✗ WebSocket 连接失败");
  process.exit(1);
};
