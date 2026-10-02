/**
 * @file webSpeechRecognizer.ts
 * @description 浏览器 Web Speech API 语音识别器
 *
 * 从 tutor.ts 提取，供语镜与语伴共用的浏览器兜底识别器。
 * 实现与提取前完全一致。
 *
 * @author Lingride Team
 * @since 1.1.0
 */

import { ISpeechRecognizer } from "../../types/pronunciationAssessment";

/**
 * 打开麦克风授权页面
 *
 * 在新标签页中打开专门的授权页面，让用户为扩展授权麦克风。
 */
function openMicrophoneAuthPage(): void {
  const authPageUrl = chrome.runtime.getURL("src/permissions/permissions.html");
  chrome.tabs.create({ url: authPageUrl });
}

export class WebSpeechRecognizer implements ISpeechRecognizer {
  private recognition: SpeechRecognition | null = null;
  private finalTranscript = "";
  private _isRecognizing = false;
  private lastConfidence = 0;

  onInterimResult?: (text: string) => void;
  onError?: (error: Error) => void;

  /**
   * 获取最后一次识别结果的置信度
   * @returns 置信度 0-1，低于 0.6 建议提示用户重试
   */
  getLastConfidence(): number {
    return this.lastConfidence;
  }

  async start(): Promise<void> {
    // 先清理之前的识别实例（解决重复录音问题）
    if (this.recognition) {
      try {
        this.recognition.onend = null; // 移除 onend 回调防止自动重启
        this.recognition.onerror = null;
        this.recognition.onresult = null;
        this.recognition.stop();
      } catch (e) {
        // 忽略停止时的错误
      }
      this.recognition = null;
    }

    // 重置状态
    this._isRecognizing = false;
    this.finalTranscript = "";
    this.lastConfidence = 0;

    // 检查浏览器支持
    const SpeechRecognitionCtor =
      window.SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition: typeof SpeechRecognition;
        }
      ).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      throw new Error("当前浏览器不支持语音识别，请使用 Chrome 浏览器");
    }

    // 先请求麦克风权限（触发浏览器权限对话框）
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 获取权限后立即停止，只是为了触发权限请求
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          // 打开授权页面
          openMicrophoneAuthPage();
          throw new Error("需要麦克风权限，已打开授权页面");
        } else if (err.name === "NotFoundError") {
          throw new Error("未检测到麦克风设备，请检查麦克风连接");
        }
      }
      throw new Error(
        "无法访问麦克风：" +
          (err instanceof Error ? err.message : String(err))
      );
    }

    this.recognition = new SpeechRecognitionCtor();
    this.recognition.lang = "en-US";
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3; // 获取多个候选结果，提高识别准确率

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        // 获取置信度最高的候选结果
        let bestAlternative = result[0];
        let bestConfidence = result[0].confidence || 0;

        // 遍历所有候选，选择置信度最高的
        for (let j = 1; j < result.length; j++) {
          const altConfidence = result[j].confidence || 0;
          if (altConfidence > bestConfidence) {
            bestAlternative = result[j];
            bestConfidence = altConfidence;
          }
        }

        const transcript = bestAlternative.transcript;

        if (result.isFinal) {
          this.finalTranscript += transcript + " ";
          // 记录最终结果的置信度
          this.lastConfidence = bestConfidence;
          console.log(
            `[Lingride ASR] Final: "${transcript}" (confidence: ${(bestConfidence * 100).toFixed(1)}%)`
          );
        } else {
          interimTranscript += transcript;
        }
      }
      // 回调实时结果
      this.onInterimResult?.(this.finalTranscript + interimTranscript);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this._isRecognizing = false;
      const errorMap: Record<string, string> = {
        "no-speech": "未检测到语音，请对着麦克风说话",
        "audio-capture": "无法访问麦克风，请检查权限设置",
        "not-allowed": "麦克风权限被拒绝，请在浏览器设置中允许",
        network: "网络错误，语音识别需要网络连接",
      };
      const message = errorMap[event.error] || `语音识别错误: ${event.error}`;
      this.onError?.(new Error(message));
    };

    this.recognition.onend = () => {
      // 如果仍在录音状态但识别意外结束，尝试重启
      if (this._isRecognizing) {
        console.log("[Lingride Tutor] 语音识别意外结束，尝试重启...");
        try {
          this.recognition?.start();
        } catch (e) {
          console.error("[Lingride Tutor] 重启语音识别失败:", e);
          this._isRecognizing = false;
        }
      }
    };

    this.recognition.start();
    this._isRecognizing = true;
  }

  async stop(): Promise<string> {
    this._isRecognizing = false;
    const result = this.finalTranscript.trim();

    if (this.recognition) {
      // 移除回调防止后续干扰
      this.recognition.onend = null;
      this.recognition.onerror = null;
      this.recognition.onresult = null;
      try {
        this.recognition.stop();
      } catch (e) {
        // 忽略停止时的错误
      }
    }

    return result;
  }

  isRecognizing(): boolean {
    return this._isRecognizing;
  }
}
