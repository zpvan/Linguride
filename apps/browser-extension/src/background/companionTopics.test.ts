import { describe, expect, it } from "vitest";

import {
  PRESET_COMPANION_TOPICS,
  parseTopicsResponse,
  pickPresetTopics,
} from "./companionTopics";

describe("pickPresetTopics", () => {
  it("返回 count 个不重复话题，排除 exclude 中的 titleEn", () => {
    const rng = () => 0.42; // 固定随机源保证确定性
    const picked = pickPresetTopics(["Weekend plans"], 5, rng);
    expect(picked).toHaveLength(5);
    expect(picked.map((t) => t.titleEn)).not.toContain("Weekend plans");
    expect(new Set(picked.map((t) => t.id)).size).toBe(5);
  });

  it("exclude 大小写不敏感；count 超过可用数时返回全部可用", () => {
    const allTitles = PRESET_COMPANION_TOPICS.map((t) => t.titleEn);
    const picked = pickPresetTopics(allTitles.map((t) => t.toUpperCase()), 5);
    expect(picked).toHaveLength(0);
    const some = pickPresetTopics(
      allTitles.slice(0, PRESET_COMPANION_TOPICS.length - 2),
      5
    );
    expect(some).toHaveLength(2);
  });
});

describe("parseTopicsResponse", () => {
  it("解析合法 JSON 数组，过滤非法项，最多 5 个，id 由 now 生成", () => {
    const raw = JSON.stringify([
      { titleZh: "咖啡文化", titleEn: "Coffee culture", openerEn: "Coffee or tea?" },
      { titleZh: "徒步", titleEn: "Hiking", openerEn: "Do you hike?" },
      { titleZh: "缺字段", titleEn: "Broken" },
      { titleZh: "多1", titleEn: "E1", openerEn: "o1" },
      { titleZh: "多2", titleEn: "E2", openerEn: "o2" },
      { titleZh: "多3", titleEn: "E3", openerEn: "o3" },
    ]);
    const topics = parseTopicsResponse(raw, 777);
    expect(topics).toHaveLength(5);
    expect(topics[0]).toEqual({
      id: "gen-777-0",
      titleZh: "咖啡文化",
      titleEn: "Coffee culture",
      openerEn: "Coffee or tea?",
    });
  });

  it("支持 ```json 包裹", () => {
    const raw = '```json\n[{"titleZh":"音乐","titleEn":"Music","openerEn":"Any songs on repeat?"}]\n```';
    expect(parseTopicsResponse(raw, 1)).toHaveLength(1);
  });

  it("完全无法解析或解析后无有效项时抛错（由调用方回退预设库）", () => {
    expect(() => parseTopicsResponse("not json", 1)).toThrow();
    expect(() => parseTopicsResponse('[{"bad":1}]', 1)).toThrow();
  });
});
