/**
 * @file createASRRecognizer.ts
 * @description ASR 识别器工厂：按用户配置创建对应识别器
 *
 * 从 tutor.ts 提取，语镜与语伴共用。
 * 选择顺序与设置页 ASR 服务商顺序一致（resolveASRSelection），
 * 未配置时抛出带引导文案的错误（由调用方展示）。
 *
 * @author Lingride Team
 * @since 1.1.0
 */

import {
  LingridConfig,
  isDoubaoASRConfigured,
  isMiniMaxASRConfigured,
  isXiaomiASRConfigured,
  resolveASRSelection,
} from "../../types";
import { ISpeechRecognizer } from "../../types/pronunciationAssessment";
import { DoubaoASRRecognizer } from "./doubaoASRRecognizer";
import { MiniMaxASRRecognizer } from "./minimaxASRRecognizer";
import { WebSpeechRecognizer } from "./webSpeechRecognizer";
import { XiaomiASRRecognizer } from "./xiaomiASRRecognizer";

/**
 * 按配置创建识别器
 *
 * @throws 所选服务未配置 API Key 时抛出带引导文案的错误
 */
export function createASRRecognizer(config: LingridConfig): ISpeechRecognizer {
  const selection = resolveASRSelection(config);

  switch (selection) {
    case "doubao":
      if (!isDoubaoASRConfigured(config)) {
        throw new Error(
          "豆包识别未配置 API Key（复用语音合成服务的豆包 Key），请到设置页配置或切换识别服务"
        );
      }
      return new DoubaoASRRecognizer();
    case "minimax":
      if (!isMiniMaxASRConfigured(config)) {
        throw new Error(
          "MiniMax 识别未配置 API Key（复用语音合成服务的 MiniMax Key），请到设置页配置或切换识别服务"
        );
      }
      return new MiniMaxASRRecognizer(config);
    case "xiaomi":
      if (!isXiaomiASRConfigured(config)) {
        throw new Error(
          "小米识别未配置 API Key（复用语音合成服务的小米 Key），请到设置页配置或切换识别服务"
        );
      }
      return new XiaomiASRRecognizer(config);
    case "browser":
      return new WebSpeechRecognizer();
  }
}
