/**
 * @file pcmCapture.ts
 * @description PCM 音频采集公共模块
 *
 * 从 doubaoASRRecognizer 抽取，供豆包（实时流式发送）与小米（批量上传）
 * 等识别器共用：AudioContext 16kHz 采集 + 重采样 + float32→int16。
 */

export const PCM_TARGET_SAMPLE_RATE = 16000;

export interface PCMCapture {
  /** 启动采集；每个 PCM 帧经回调吐出（已重采样至 16kHz int16） */
  start(stream: MediaStream): void;
  /** 停止采集并释放节点（不关闭传入的 stream，由调用方管理） */
  stop(): void;
}

/**
 * 创建 PCM 采集器。
 *
 * @param onChunk 每个 PCM 帧（Int16Array，16kHz mono）的回调
 */
export function createPCMCapture(
  onChunk: (chunk: Int16Array) => void
): PCMCapture {
  let audioContext: AudioContext | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let processorNode: ScriptProcessorNode | null = null;

  function resample(
    input: Float32Array,
    fromRate: number,
    toRate: number
  ): Float32Array {
    const ratio = fromRate / toRate;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      output[i] = input[Math.floor(i * ratio)];
    }
    return output;
  }

  function float32ToInt16(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  return {
    start(stream: MediaStream): void {
      // 重复 start 是未定义行为；防御性忽略，避免覆盖未关闭的 AudioContext
      if (audioContext) return;

      // 尝试 16kHz 采样率；不支持则用默认采样率并重采样
      try {
        audioContext = new AudioContext({
          sampleRate: PCM_TARGET_SAMPLE_RATE,
        });
      } catch {
        audioContext = new AudioContext();
        console.log(
          `[Lingride PCMCapture] 使用默认采样率: ${audioContext.sampleRate}Hz`
        );
      }

      const ctx = audioContext;
      sourceNode = ctx.createMediaStreamSource(stream);
      processorNode = ctx.createScriptProcessor(4096, 1, 1);

      processorNode.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const pcmData =
          ctx.sampleRate !== PCM_TARGET_SAMPLE_RATE
            ? resample(inputData, ctx.sampleRate, PCM_TARGET_SAMPLE_RATE)
            : inputData;
        onChunk(float32ToInt16(pcmData));
      };

      sourceNode.connect(processorNode);
      processorNode.connect(ctx.destination);
    },

    stop(): void {
      processorNode?.disconnect();
      sourceNode?.disconnect();
      processorNode = null;
      sourceNode = null;
      if (audioContext) {
        void audioContext.close();
        audioContext = null;
      }
    },
  };
}
