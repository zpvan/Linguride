/**
 * @file flashcardMarineAnimalsExpansion.ts
 * @description 海洋动物分类 32 张卡片的精确测试数据
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

export const marineAnimalsExpansion = [
  ["shark", i("marine-animals-shark"), B.gray], ["hammerhead shark", i("marine-animals-hammerhead-shark"), B.gray],
  ["ray", i("marine-animals-ray"), B.blue], ["jellyfish", i("marine-animals-jellyfish"), B.purple],
  ["starfish", i("marine-animals-starfish"), B.orange], ["seahorse", i("marine-animals-seahorse"), B.yellow],
  ["sea turtle", i("marine-animals-sea-turtle"), B.green], ["seal", i("marine-animals-seal"), B.gray],
  ["sea lion", i("marine-animals-sea-lion"), B.brown], ["walrus", i("marine-animals-walrus"), B.brown],
  ["sea otter", i("marine-animals-sea-otter"), B.brown], ["manatee", i("marine-animals-manatee"), B.gray],
  ["beluga", i("marine-animals-beluga"), B.cyan], ["narwhal", i("marine-animals-narwhal"), B.purple],
  ["orca", i("marine-animals-orca"), B.gray], ["squid", i("marine-animals-squid"), B.purple],
  ["cuttlefish", i("marine-animals-cuttlefish"), B.brown], ["nautilus", i("marine-animals-nautilus"), B.orange],
  ["sea urchin", i("marine-animals-sea-urchin"), B.purple], ["sea anemone", i("marine-animals-sea-anemone"), B.pink],
  ["coral", i("marine-animals-coral"), B.orange], ["clownfish", i("marine-animals-clownfish"), B.orange],
  ["angelfish", i("marine-animals-angelfish"), B.yellow], ["pufferfish", i("marine-animals-pufferfish"), B.yellow],
  ["swordfish", i("marine-animals-swordfish"), B.blue], ["eel", i("marine-animals-eel"), B.green],
  ["flying fish", i("marine-animals-flying-fish"), B.cyan], ["sea snake", i("marine-animals-sea-snake"), B.green],
  ["horseshoe crab", i("marine-animals-horseshoe-crab"), B.brown], ["krill", i("marine-animals-krill"), B.pink],
  ["sea cucumber", i("marine-animals-sea-cucumber"), B.green], ["hermit crab", i("marine-animals-hermit-crab"), B.orange],
] satisfies readonly ExpansionEntry[];
