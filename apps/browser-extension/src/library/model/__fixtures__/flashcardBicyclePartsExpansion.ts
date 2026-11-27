/**
 * @file flashcardBicyclePartsExpansion.ts
 * @description 自行车零部件分类 32 张卡片的精确测试数据
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

export const bicyclePartsExpansion = [
  ["frame", i("bicycle-parts-frame"), B.blue], ["fork", i("bicycle-parts-fork"), B.cyan],
  ["handlebar", i("bicycle-parts-handlebar"), B.gray], ["grip", i("bicycle-parts-grip"), B.orange],
  ["saddle", i("bicycle-parts-saddle"), B.brown], ["seatpost", i("bicycle-parts-seatpost"), B.gray],
  ["wheel", i("bicycle-parts-wheel"), B.blue], ["tire", i("bicycle-parts-tire"), B.gray],
  ["inner tube", i("bicycle-parts-inner-tube"), B.cyan], ["rim", i("bicycle-parts-rim"), B.gray],
  ["spoke", i("bicycle-parts-spoke"), B.blue], ["hub", i("bicycle-parts-hub"), B.purple],
  ["chain", i("bicycle-parts-chain"), B.gray], ["chainring", i("bicycle-parts-chainring"), B.orange],
  ["crank arm", i("bicycle-parts-crank-arm"), B.purple], ["pedal", i("bicycle-parts-pedal"), B.green],
  ["cassette", i("bicycle-parts-cassette"), B.gray], ["derailleur", i("bicycle-parts-derailleur"), B.purple],
  ["gear shifter", i("bicycle-parts-gear-shifter"), B.orange], ["brake lever", i("bicycle-parts-brake-lever"), B.pink],
  ["brake caliper", i("bicycle-parts-brake-caliper"), B.gray], ["brake pad", i("bicycle-parts-brake-pad"), B.brown],
  ["brake cable", i("bicycle-parts-brake-cable"), B.gray], ["headset", i("bicycle-parts-headset"), B.cyan],
  ["stem", i("bicycle-parts-stem"), B.gray], ["kickstand", i("bicycle-parts-kickstand"), B.green],
  ["mudguard", i("bicycle-parts-mudguard"), B.blue], ["chain guard", i("bicycle-parts-chain-guard"), B.yellow],
  ["bell", i("bicycle-parts-bell"), B.yellow], ["water bottle cage", i("bicycle-parts-water-bottle-cage"), B.cyan],
  ["front light", i("bicycle-parts-front-light"), B.yellow], ["reflector", i("bicycle-parts-reflector"), B.orange],
] satisfies readonly ExpansionEntry[];
