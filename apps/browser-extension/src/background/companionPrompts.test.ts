import { describe, expect, it } from "vitest";

import { MemoryFact, TopicCard } from "../types/companion";
import {
  MAX_INJECT_FACTS,
  buildCompanionSystemPrompt,
  buildHintPrompts,
  buildSummaryPrompts,
  buildTopicsPrompts,
  buildTranscript,
  parseHintsResponse,
} from "./companionPrompts";

const topic: TopicCard = {
  id: "t1",
  titleZh: "周末计划",
  titleEn: "Weekend plans",
  openerEn: "Any fun plans for the weekend?",
};

function fact(text: string, lastSeenAt: number): MemoryFact {
  return { text, createdAt: lastSeenAt, lastSeenAt };
}

describe("buildCompanionSystemPrompt", () => {
  it("包含人格、难度、话题块，无记忆时不出现记忆块", () => {
    const prompt = buildCompanionSystemPrompt({ topic, level: "B1", facts: [] });
    expect(prompt).toContain("You are Echo");
    expect(prompt).toContain("B1");
    expect(prompt).toContain("Weekend plans");
    expect(prompt).toContain("周末计划");
    expect(prompt).not.toContain("What you remember about the user");
  });

  it("有记忆时注入记忆块，且最多注入 MAX_INJECT_FACTS 条（最近优先）", () => {
    const facts = Array.from({ length: 15 }, (_, i) =>
      fact(`fact-${i}`, i + 1)
    );
    const prompt = buildCompanionSystemPrompt({ topic, level: "A2", facts });
    expect(prompt).toContain("What you remember about the user");
    // 最近 10 条（fact-5..fact-14）注入；最旧的 fact-0..fact-4 不注入
    expect(prompt).toContain("fact-14");
    expect(prompt).toContain("fact-5");
    expect(prompt).not.toContain("fact-4");
    expect(MAX_INJECT_FACTS).toBe(10);
  });

  it("每个等级都有对应的难度指导文案", () => {
    for (const level of ["A1", "A2", "B1", "B2", "C1", "C2"] as const) {
      const prompt = buildCompanionSystemPrompt({ topic, level, facts: [] });
      expect(prompt).toContain(`English level is ${level}`);
    }
  });
});

describe("buildTranscript", () => {
  it("按 User:/Echo: 前缀输出，超出 maxTurns 时保留最近轮次", () => {
    const turns = [
      { role: "user" as const, content: "u1" },
      { role: "assistant" as const, content: "a1" },
      { role: "user" as const, content: "u2" },
    ];
    expect(buildTranscript(turns)).toBe("User: u1\nEcho: a1\nUser: u2");
    expect(buildTranscript(turns, 2)).toBe("Echo: a1\nUser: u2");
  });
});

describe("buildTopicsPrompts / buildHintPrompts / buildSummaryPrompts", () => {
  it("topics：等级进入 system，exclude 与 facts 进入 user", () => {
    const { system, user } = buildTopicsPrompts({
      level: "B2",
      exclude: ["Movies", "Food"],
      facts: [fact("User likes sci-fi movies", 1)],
    });
    expect(system).toContain("B2");
    expect(user).toContain("Movies");
    expect(user).toContain("sci-fi");
  });

  it("hint：携带最近对话与话题", () => {
    const { system, user } = buildHintPrompts({
      turns: [{ role: "user", content: "I like hiking" }],
      topic,
      level: "A2",
    });
    expect(system).toContain("A2");
    expect(user).toContain("Weekend plans");
    expect(user).toContain("I like hiking");
  });

  it("summary：携带旧事实与对话", () => {
    const { system, user } = buildSummaryPrompts({
      turns: [{ role: "assistant", content: "Hello!" }],
      topic,
      level: "B1",
      facts: [fact("User works as a PM", 1)],
    });
    expect(system).toContain("B1");
    expect(user).toContain("User works as a PM");
    expect(user).toContain("Echo: Hello!");
  });
});

describe("parseHintsResponse", () => {
  it("解析 JSON 数组并过滤非法项，最多保留 2 条", () => {
    const raw = JSON.stringify([
      { en: "Sounds fun!", zh: "听起来不错！" },
      { en: "I went hiking.", zh: "我去爬山了。" },
      { en: "extra", zh: "多余" },
      { en: 123 },
    ]);
    expect(parseHintsResponse(raw)).toEqual([
      { en: "Sounds fun!", zh: "听起来不错！" },
      { en: "I went hiking.", zh: "我去爬山了。" },
    ]);
  });

  it("支持 ```json 包裹；完全无法解析时返回空数组", () => {
    expect(parseHintsResponse('```json\n[{"en":"a","zh":"甲"}]\n```')).toEqual([
      { en: "a", zh: "甲" },
    ]);
    expect(parseHintsResponse("not json at all")).toEqual([]);
  });
});
