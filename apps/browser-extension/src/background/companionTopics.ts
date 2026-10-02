/**
 * @file companionTopics.ts
 * @description 「语伴」话题系统：内置预设库 + AI 换一批的响应解析
 *
 * - 首次进入用预设库随机抽取，零延迟开聊
 * - 「换一批」由 companionBridge 调 LLM 生成，本模块负责解析；
 *   解析失败时由调用方回退到预设库
 *
 * @author Lingride Team
 * @since 1.1.0
 */

import { TopicCard } from "../types/companion";
import { extractJsonText } from "./aiJsonExtract";

/** 内置预设话题库（首次进入与 AI 生成失败时的回退来源） */
export const PRESET_COMPANION_TOPICS: TopicCard[] = [
  { id: "preset-weekend", titleZh: "周末计划", titleEn: "Weekend plans", openerEn: "Any fun plans for the weekend?" },
  { id: "preset-food", titleZh: "最近吃到的美食", titleEn: "Food you've tried lately", openerEn: "Have you eaten anything really good recently?" },
  { id: "preset-shows", titleZh: "值得追的剧", titleEn: "Shows worth watching", openerEn: "Are you watching any good shows these days?" },
  { id: "preset-movies", titleZh: "最近看的电影", titleEn: "Movies you've seen", openerEn: "Seen any good movies lately?" },
  { id: "preset-travel", titleZh: "梦想旅行地", titleEn: "Dream travel destinations", openerEn: "If you could travel anywhere, where would you go?" },
  { id: "preset-work", titleZh: "工作日常", titleEn: "Your workday", openerEn: "What does a typical workday look like for you?" },
  { id: "preset-hometown", titleZh: "家乡", titleEn: "Your hometown", openerEn: "Tell me about your hometown. What's it like?" },
  { id: "preset-hobby", titleZh: "兴趣爱好", titleEn: "Hobbies", openerEn: "What do you usually do in your free time?" },
  { id: "preset-sports", titleZh: "运动习惯", titleEn: "Sports and exercise", openerEn: "Do you play any sports or work out?" },
  { id: "preset-music", titleZh: "音乐口味", titleEn: "Music you love", openerEn: "What kind of music have you been into lately?" },
  { id: "preset-pets", titleZh: "宠物", titleEn: "Pets", openerEn: "Do you have any pets, or would you like one?" },
  { id: "preset-coffee", titleZh: "咖啡或茶", titleEn: "Coffee or tea", openerEn: "Are you a coffee person or a tea person?" },
  { id: "preset-seasons", titleZh: "喜欢的季节", titleEn: "Favorite season", openerEn: "Which season do you like best, and why?" },
  { id: "preset-apps", titleZh: "好用的 App", titleEn: "Apps you can't live without", openerEn: "What's one app you use every single day?" },
  { id: "preset-childhood", titleZh: "童年回忆", titleEn: "Childhood memories", openerEn: "What's a fun memory from your childhood?" },
  { id: "preset-morning", titleZh: "早晨例事", titleEn: "Morning routines", openerEn: "Are you a morning person?" },
  { id: "preset-cooking", titleZh: "下厨", titleEn: "Cooking", openerEn: "Do you cook? What's your best dish?" },
  { id: "preset-shopping", titleZh: "网购", titleEn: "Online shopping", openerEn: "What was the last thing you bought online?" },
  { id: "preset-weather", titleZh: "最近的天气", titleEn: "Weather lately", openerEn: "How's the weather been in your city lately?" },
  { id: "preset-english", titleZh: "学英语这件事", titleEn: "Learning English", openerEn: "What made you want to learn English?" },
];

/**
 * 从预设库随机抽取话题
 *
 * @param exclude - 需排除的 titleEn（大小写不敏感），防"换一批"重复
 * @param count - 抽取数量，可用不足时返回全部可用
 * @param rng - 随机源（注入便于测试）
 */
export function pickPresetTopics(
  exclude: string[],
  count = 5,
  rng: () => number = Math.random
): TopicCard[] {
  const excluded = new Set(exclude.map((t) => t.trim().toLowerCase()));
  const pool = PRESET_COMPANION_TOPICS.filter(
    (t) => !excluded.has(t.titleEn.toLowerCase())
  );
  // Fisher-Yates 洗牌（注入 rng 保证可测）
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/**
 * 解析 AI 生成的话题响应
 *
 * @param raw - LLM 原始输出
 * @param now - 时间戳（生成 id 用，注入便于测试）
 * @returns 最多 5 个有效话题
 * @throws 完全无法解析或无有效项时抛错（调用方回退预设库）
 */
export function parseTopicsResponse(
  raw: string,
  now: number = Date.now()
): TopicCard[] {
  const parsed: unknown = JSON.parse(extractJsonText(raw));
  if (!Array.isArray(parsed)) {
    throw new Error("话题响应不是 JSON 数组");
  }
  const topics = parsed
    .filter(
      (item): item is Omit<TopicCard, "id"> =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as TopicCard).titleZh === "string" &&
        typeof (item as TopicCard).titleEn === "string" &&
        typeof (item as TopicCard).openerEn === "string" &&
        (item as TopicCard).titleZh.trim().length > 0 &&
        (item as TopicCard).titleEn.trim().length > 0
    )
    .slice(0, 5)
    .map((item, index) => ({
      id: `gen-${now}-${index}`,
      titleZh: item.titleZh.trim(),
      titleEn: item.titleEn.trim(),
      openerEn: item.openerEn.trim(),
    }));
  if (topics.length === 0) {
    throw new Error("话题响应中无有效话题");
  }
  return topics;
}
