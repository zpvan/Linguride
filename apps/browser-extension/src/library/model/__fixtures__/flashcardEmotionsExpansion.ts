/**
 * @file flashcardEmotionsExpansion.ts
 * @description 情绪与感觉分类 32 张卡片的精确测试数据
 */

import type { ExpansionEntry } from "./flashcardExpansionTypes";

const B = {
  yellow: ["#fff8d9", "#f3e2a4"], blue: ["#e2f4ff", "#b9dcf5"],
  orange: ["#fff0e1", "#ffcfbf"], green: ["#e5f8ed", "#bce6cc"],
  purple: ["#f0e6ff", "#d6c1f5"], pink: ["#fff0f5", "#f6c9da"],
  cyan: ["#e0f7fa", "#b2ebf2"], gray: ["#f0f0f5", "#d5d5e2"],
} as const;
const e = (emoji: string): ExpansionEntry[1] => ({ kind: "emoji", emoji });

export const emotionsExpansion = [
  ["happy", e("😊"), B.yellow], ["sad", e("😢"), B.blue],
  ["angry", e("😠"), B.orange], ["surprised", e("😮"), B.yellow],
  ["scared", e("😨"), B.purple], ["tired", e("😴"), B.gray],
  ["excited", e("🤩"), B.orange], ["nervous", e("😰"), B.purple],
  ["calm", e("🧘"), B.green], ["relaxed", e("😌"), B.green],
  ["proud", e("🏆"), B.orange], ["confident", e("😎"), B.orange],
  ["shy", e("🫣"), B.pink], ["embarrassed", e("😳"), B.pink],
  ["bored", e("😑"), B.gray], ["curious", e("🤔"), B.cyan],
  ["confused", e("😕"), B.purple], ["worried", e("😟"), B.purple],
  ["stressed", e("😩"), B.orange], ["frustrated", e("😣"), B.orange],
  ["disappointed", e("😞"), B.blue], ["jealous", e("😒"), B.green],
  ["grateful", e("🙏"), B.pink], ["hopeful", e("🤞"), B.yellow],
  ["cheerful", e("😄"), B.yellow], ["silly", e("🤪"), B.orange],
  ["playful", e("😜"), B.orange], ["lonely", e("🧍"), B.blue],
  ["loved", e("🥰"), B.pink], ["safe", e("🛡️"), B.green],
  ["brave", e("💪"), B.orange], ["guilty", e("😔"), B.purple],
] satisfies readonly ExpansionEntry[];
