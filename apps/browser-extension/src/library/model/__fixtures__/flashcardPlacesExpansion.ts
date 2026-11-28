/**
 * @file flashcardPlacesExpansion.ts
 * @description 城市与社区场所分类 32 张卡片的精确测试数据
 */

import type { ExpansionEntry } from "./flashcardExpansionTypes";

const B = {
  blue: ["#e2f4ff", "#b9dcf5"], orange: ["#fff0e1", "#ffcfbf"],
  green: ["#e5f8ed", "#bce6cc"], purple: ["#f0e6ff", "#d6c1f5"],
  pink: ["#fff0f5", "#f6c9da"], yellow: ["#fff8d9", "#f3e2a4"], cyan: ["#e0f7fa", "#b2ebf2"],
  gray: ["#f0f0f5", "#d5d5e2"], brown: ["#f3eadf", "#dfc3a5"],
} as const;
const i = (cardId: string): ExpansionEntry[1] => ({ kind: "illustration", illustration: cardId });

export const placesExpansion = [
  ["hospital", i("places-hospital"), B.cyan], ["bank", i("places-bank"), B.yellow],
  ["library", i("places-library"), B.brown], ["post office", i("places-post-office"), B.orange],
  ["fire station", i("places-fire-station"), B.orange], ["police station", i("places-police-station"), B.blue],
  ["supermarket", i("places-supermarket"), B.green], ["restaurant", i("places-restaurant"), B.orange],
  ["cafe", i("places-cafe"), B.brown], ["bakery", i("places-bakery"), B.yellow],
  ["hotel", i("places-hotel"), B.purple], ["theater", i("places-theater"), B.purple],
  ["museum", i("places-museum"), B.gray], ["zoo", i("places-zoo"), B.green],
  ["park", i("places-park"), B.green], ["playground", i("places-playground"), B.pink],
  ["swimming pool", i("places-swimming-pool"), B.cyan], ["stadium", i("places-stadium"), B.green],
  ["gym", i("places-gym"), B.purple], ["airport", i("places-airport"), B.blue],
  ["train station", i("places-train-station"), B.gray], ["bus stop", i("places-bus-stop"), B.orange],
  ["harbor", i("places-harbor"), B.cyan], ["gas station", i("places-gas-station"), B.orange],
  ["parking lot", i("places-parking-lot"), B.gray], ["pharmacy", i("places-pharmacy"), B.green],
  ["church", i("places-church"), B.gray], ["mosque", i("places-mosque"), B.green],
  ["temple", i("places-temple"), B.orange], ["factory", i("places-factory"), B.gray],
  ["office", i("places-office"), B.blue], ["city hall", i("places-city-hall"), B.yellow],
] satisfies readonly ExpansionEntry[];
