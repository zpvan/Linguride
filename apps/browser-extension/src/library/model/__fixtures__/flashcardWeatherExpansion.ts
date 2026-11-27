/**
 * @file flashcardWeatherExpansion.ts
 * @description 天气气候分类 32 张卡片的精确测试数据
 */

import type { ExpansionEntry } from "./flashcardExpansionTypes";

const B = {
  blue: ["#e2f4ff", "#b9dcf5"], orange: ["#fff0e1", "#ffcfbf"],
  green: ["#e5f8ed", "#bce6cc"], purple: ["#f0e6ff", "#d6c1f5"],
  yellow: ["#fff8d9", "#f3e2a4"], cyan: ["#e0f7fa", "#b2ebf2"],
  gray: ["#f0f0f5", "#d5d5e2"],
} as const;
const i = (cardId: string): ExpansionEntry[1] => ({ kind: "illustration", illustration: cardId });

export const weatherExpansion = [
  ["sunny", i("weather-sunny"), B.yellow], ["partly cloudy", i("weather-partly-cloudy"), B.yellow],
  ["cloudy", i("weather-cloudy"), B.gray], ["rainy", i("weather-rainy"), B.blue],
  ["drizzle", i("weather-drizzle"), B.cyan], ["thunderstorm", i("weather-thunderstorm"), B.gray],
  ["lightning", i("weather-lightning"), B.yellow], ["snowy", i("weather-snowy"), B.blue],
  ["blizzard", i("weather-blizzard"), B.cyan], ["sleet", i("weather-sleet"), B.cyan],
  ["hail", i("weather-hail"), B.gray], ["foggy", i("weather-foggy"), B.gray],
  ["windy", i("weather-windy"), B.cyan], ["stormy", i("weather-stormy"), B.gray],
  ["tornado", i("weather-tornado"), B.gray], ["hurricane", i("weather-hurricane"), B.purple],
  ["rainbow", i("weather-rainbow"), B.purple], ["frost", i("weather-frost"), B.cyan],
  ["ice", i("weather-ice"), B.blue], ["dew", i("weather-dew"), B.green],
  ["hot", i("weather-hot"), B.orange], ["cold", i("weather-cold"), B.blue],
  ["warm", i("weather-warm"), B.yellow], ["cool", i("weather-cool"), B.cyan],
  ["humid", i("weather-humid"), B.cyan], ["dry", i("weather-dry"), B.orange],
  ["drought", i("weather-drought"), B.orange], ["flood", i("weather-flood"), B.blue],
  ["heat wave", i("weather-heat-wave"), B.orange], ["monsoon", i("weather-monsoon"), B.blue],
  ["tropical climate", i("weather-tropical-climate"), B.green], ["polar climate", i("weather-polar-climate"), B.cyan],
] satisfies readonly ExpansionEntry[];
