/**
 * @file flashcardMusicExpansion.ts
 * @description 乐器与音乐分类 32 张卡片的精确测试数据
 */

import type { ExpansionEntry } from "./flashcardExpansionTypes";

const B = {
  blue: ["#e2f4ff", "#b9dcf5"], orange: ["#fff0e1", "#ffcfbf"],
  purple: ["#f0e6ff", "#d6c1f5"], pink: ["#fff0f5", "#f6c9da"],
  yellow: ["#fff8d9", "#f3e2a4"], gray: ["#f0f0f5", "#d5d5e2"],
  brown: ["#f3eadf", "#dfc3a5"],
} as const;
const i = (cardId: string): ExpansionEntry[1] => ({ kind: "illustration", illustration: cardId });

export const musicExpansion = [
  ["piano", i("music-piano"), B.gray], ["guitar", i("music-guitar"), B.orange],
  ["violin", i("music-violin"), B.brown], ["cello", i("music-cello"), B.brown],
  ["harp", i("music-harp"), B.yellow], ["drum", i("music-drum"), B.pink],
  ["drum kit", i("music-drum-kit"), B.gray], ["tambourine", i("music-tambourine"), B.yellow],
  ["xylophone", i("music-xylophone"), B.purple], ["maracas", i("music-maracas"), B.orange],
  ["trumpet", i("music-trumpet"), B.yellow], ["trombone", i("music-trombone"), B.yellow],
  ["french horn", i("music-french-horn"), B.yellow], ["saxophone", i("music-saxophone"), B.yellow],
  ["flute", i("music-flute"), B.gray], ["clarinet", i("music-clarinet"), B.gray],
  ["oboe", i("music-oboe"), B.brown], ["recorder", i("music-recorder"), B.brown],
  ["harmonica", i("music-harmonica"), B.gray], ["accordion", i("music-accordion"), B.pink],
  ["ukulele", i("music-ukulele"), B.orange], ["banjo", i("music-banjo"), B.brown],
  ["cymbals", i("music-cymbals"), B.yellow], ["microphone", i("music-microphone"), B.gray],
  ["headphones", i("music-headphones"), B.purple], ["speaker", i("music-speaker"), B.gray],
  ["sheet music", i("music-sheet-music"), B.gray], ["metronome", i("music-metronome"), B.brown],
  ["turntable", i("music-turntable"), B.purple], ["synthesizer", i("music-synthesizer"), B.blue],
  ["conductor", i("music-conductor"), B.purple], ["music note", i("music-music-note"), B.purple],
] satisfies readonly ExpansionEntry[];
