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
const i = (cardId: string): ExpansionEntry[1] => ({ kind: "illustration", illustration: cardId });

export const emotionsExpansion = [
  ["happy", i("emotions-happy"), B.yellow], ["sad", i("emotions-sad"), B.blue],
  ["angry", i("emotions-angry"), B.orange], ["surprised", i("emotions-surprised"), B.yellow],
  ["scared", i("emotions-scared"), B.purple], ["tired", i("emotions-tired"), B.gray],
  ["excited", i("emotions-excited"), B.orange], ["nervous", i("emotions-nervous"), B.purple],
  ["calm", i("emotions-calm"), B.green], ["relaxed", i("emotions-relaxed"), B.green],
  ["proud", i("emotions-proud"), B.orange], ["confident", i("emotions-confident"), B.orange],
  ["shy", i("emotions-shy"), B.pink], ["embarrassed", i("emotions-embarrassed"), B.pink],
  ["bored", i("emotions-bored"), B.gray], ["curious", i("emotions-curious"), B.cyan],
  ["confused", i("emotions-confused"), B.purple], ["worried", i("emotions-worried"), B.purple],
  ["stressed", i("emotions-stressed"), B.orange], ["frustrated", i("emotions-frustrated"), B.orange],
  ["disappointed", i("emotions-disappointed"), B.blue], ["jealous", i("emotions-jealous"), B.green],
  ["grateful", i("emotions-grateful"), B.pink], ["hopeful", i("emotions-hopeful"), B.yellow],
  ["cheerful", i("emotions-cheerful"), B.yellow], ["silly", i("emotions-silly"), B.orange],
  ["playful", i("emotions-playful"), B.orange], ["lonely", i("emotions-lonely"), B.blue],
  ["loved", i("emotions-loved"), B.pink], ["safe", i("emotions-safe"), B.green],
  ["brave", i("emotions-brave"), B.orange], ["guilty", i("emotions-guilty"), B.purple],
] satisfies readonly ExpansionEntry[];
