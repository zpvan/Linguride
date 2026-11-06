/**
 * @file flashcardBasicExpansion.ts
 * @description 第一批形状、颜色、动作扩充卡片的精确测试数据
 */

import type { FlashcardArt } from "../flashcard";
import type { ExpansionEntry } from "./flashcardExpansionTypes";

const B = {
  blue: ["#e2f4ff", "#b9dcf5"], orange: ["#fff0e1", "#ffcfbf"],
  green: ["#e5f8ed", "#bce6cc"], purple: ["#f0e6ff", "#d6c1f5"],
  pink: ["#fff0f5", "#f6c9da"], yellow: ["#fff8d9", "#f3e2a4"],
  red: ["#fff1f2", "#fecdd3"], cyan: ["#e0f7fa", "#b2ebf2"],
  gray: ["#f0f0f5", "#d5d5e2"], brown: ["#f3eadf", "#dfc3a5"],
  slate: ["#f8fafc", "#e2e8f0"], silver: ["#f8fafc", "#dbe3ec"],
  cream: ["#fffdf5", "#e8dfc8"], ivory: ["#f5f1e6", "#ded7c7"],
  paleYellow: ["#fff8e7", "#ead9b8"], navy: ["#eff6ff", "#c7d2fe"],
  teal: ["#f0fdfa", "#99f6e4"], paleCyan: ["#ecfeff", "#a5f3fc"],
  paleTeal: ["#f0fdfa", "#ccfbf1"], sky: ["#f0f9ff", "#bae6fd"],
  lightBlue: ["#f0f9ff", "#e0f2fe"], lime: ["#f7fee7", "#d9f99d"],
  olive: ["#fefce8", "#e7e5c0"], mint: ["#f0fdf4", "#bbf7d0"],
  lavender: ["#faf5ff", "#e9d5ff"], violet: ["#faf5ff", "#ddd6fe"],
  magenta: ["#fdf4ff", "#f5d0fe"], white: ["#e2e8f0", "#cbd5e1"],
} as const;
const e = (emoji: string): FlashcardArt => ({ kind: "emoji", emoji });
const circle = (color: string): FlashcardArt => ({ kind: "vector", shape: "circle", color });

export const basicExpansion = {
  shapes: [
    ["pentagon", e("⬟"), B.blue], ["hexagon", e("⬡"), B.orange],
    ["octagon", e("🛑"), B.red], ["trapezoid", e("⏢"), B.green],
    ["rhombus", e("🔶"), B.purple], ["parallelogram", e("▱"), B.cyan],
    ["semicircle", e("◒"), B.yellow], ["crescent", e("🌙"), B.gray],
    ["arc", e("⌒"), B.blue], ["cube", e("🧊"), B.cyan],
    ["sphere", e("🔮"), B.purple], ["cone", e("🍦"), B.orange],
    ["cylinder", e("🥫"), B.gray], ["pyramid", e("🔺🏜️"), B.yellow],
    ["prism", e("💎"), B.pink], ["cross", e("➕"), B.red],
    ["arrow", e("➡️"), B.blue], ["line", e("➖"), B.gray],
    ["dot", e("⚫"), B.purple], ["ring", e("⭕"), B.red],
    ["frame", e("🖼️"), B.brown], ["spiral", e("🌀"), B.cyan],
    ["wave", e("〰️"), B.blue], ["zigzag", e("⚡"), B.yellow],
  ],
  colors: [
    ["black", circle("#111827"), B.slate], ["white", circle("#ffffff"), B.white],
    ["gray", circle("#6b7280"), B.gray], ["gold", circle("#d4af37"), B.yellow],
    ["silver", circle("#c0c0c0"), B.silver], ["beige", circle("#f5f5dc"), B.cream],
    ["ivory", circle("#fffff0"), B.ivory], ["cream", circle("#fffdd0"), B.paleYellow],
    ["navy", circle("#001f3f"), B.navy], ["teal", circle("#008080"), B.teal],
    ["cyan", circle("#00ffff"), B.paleCyan], ["turquoise", circle("#40e0d0"), B.paleTeal],
    ["aqua", circle("#00bcd4"), B.cyan], ["sky blue", circle("#87ceeb"), B.sky],
    ["royal blue", circle("#4169e1"), B.blue], ["light blue", circle("#add8e6"), B.lightBlue],
    ["dark blue", circle("#00008b"), B.slate], ["lime", circle("#32cd32"), B.lime],
    ["olive", circle("#808000"), B.olive], ["mint", circle("#98ff98"), B.mint],
    ["lavender", circle("#e6e6fa"), B.lavender], ["violet", circle("#8f00ff"), B.violet],
    ["magenta", circle("#ff00ff"), B.magenta], ["maroon", circle("#800000"), B.red],
  ],
  actions: [
    ["wake up", e("⏰😴"), B.yellow], ["get up", e("🧍🛏️"), B.orange],
    ["go", e("🧒➡️"), B.blue], ["come", e("🧒⬅️"), B.green],
    ["stop", e("✋"), B.red], ["listen", e("🧒🎧"), B.purple],
    ["look", e("👀"), B.cyan], ["watch", e("🧒📺"), B.gray],
    ["see", e("👁️"), B.blue], ["hear", e("👂"), B.brown],
    ["speak", e("🗣️"), B.orange], ["talk", e("💬"), B.cyan],
    ["ask", e("🙋❓"), B.pink], ["answer", e("🧒✅"), B.green],
    ["open", e("🚪🔓"), B.yellow], ["close", e("🚪🔒"), B.gray],
  ],
} satisfies Record<string, readonly ExpansionEntry[]>;
