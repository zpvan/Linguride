/**
 * @file flashcardSportsExpansion.ts
 * @description 运动赛事分类 32 张卡片的精确测试数据
 */

import type { ExpansionEntry } from "./flashcardExpansionTypes";

const B = {
  blue: ["#e2f4ff", "#b9dcf5"], orange: ["#fff0e1", "#ffcfbf"],
  green: ["#e5f8ed", "#bce6cc"], purple: ["#f0e6ff", "#d6c1f5"],
  pink: ["#fff0f5", "#f6c9da"], yellow: ["#fff8d9", "#f3e2a4"],
  cyan: ["#e0f7fa", "#b2ebf2"], gray: ["#f0f0f5", "#d5d5e2"],
  brown: ["#f3eadf", "#dfc3a5"],
} as const;
const i = (cardId: string): ExpansionEntry[1] => ({ kind: "illustration", illustration: cardId });

export const sportsExpansion = [
  ["soccer", i("sports-soccer"), B.blue], ["basketball", i("sports-basketball"), B.orange],
  ["volleyball", i("sports-volleyball"), B.yellow], ["tennis", i("sports-tennis"), B.green],
  ["table tennis", i("sports-table-tennis"), B.orange], ["badminton", i("sports-badminton"), B.purple],
  ["baseball", i("sports-baseball"), B.gray], ["rugby", i("sports-rugby"), B.brown],
  ["golf", i("sports-golf"), B.green], ["handball", i("sports-handball"), B.orange],
  ["field hockey", i("sports-field-hockey"), B.green], ["ice hockey", i("sports-ice-hockey"), B.cyan],
  ["water polo", i("sports-water-polo"), B.cyan], ["swimming", i("sports-swimming"), B.blue],
  ["diving", i("sports-diving"), B.cyan], ["rowing", i("sports-rowing"), B.blue],
  ["sailing", i("sports-sailing"), B.cyan], ["surfing", i("sports-surfing"), B.blue],
  ["gymnastics", i("sports-gymnastics"), B.purple], ["marathon", i("sports-marathon"), B.orange],
  ["cycling", i("sports-cycling"), B.green], ["equestrian", i("sports-equestrian"), B.yellow],
  ["fencing", i("sports-fencing"), B.gray], ["boxing", i("sports-boxing"), B.pink],
  ["judo", i("sports-judo"), B.gray], ["taekwondo", i("sports-taekwondo"), B.orange],
  ["archery", i("sports-archery"), B.green], ["shooting", i("sports-shooting"), B.gray],
  ["weightlifting", i("sports-weightlifting"), B.purple], ["skiing", i("sports-skiing"), B.cyan],
  ["snowboarding", i("sports-snowboarding"), B.purple], ["curling", i("sports-curling"), B.blue],
] satisfies readonly ExpansionEntry[];
