import { describe, expect, it } from "vitest";

import { parseSummaryResponse } from "./companionSummary";

const VALID = {
  fluencyComment: "今天聊得很放松，开头那句特别地道！",
  highlights: [
    { en: "It went really well", note: "过去式用得准确" },
    { en: "I'm looking forward to it", note: "地道表达" },
  ],
  improvements: [
    { original: "I very like it", better: "I really like it", note: "very 不直接修饰动词" },
  ],
  memoryUpdate: { add: ["User just launched a product"], remove: [] },
};

describe("parseSummaryResponse", () => {
  it("解析完整 JSON，字段齐全", () => {
    const result = parseSummaryResponse(JSON.stringify(VALID));
    expect(result.summary.fluencyComment).toContain("放松");
    expect(result.summary.highlights).toHaveLength(2);
    expect(result.summary.improvements).toHaveLength(1);
    expect(result.memoryUpdate.add).toEqual(["User just launched a product"]);
  });

  it("支持 ```json 包裹", () => {
    const result = parseSummaryResponse(
      "```json\n" + JSON.stringify(VALID) + "\n```"
    );
    expect(result.summary.highlights).toHaveLength(2);
  });

  it("缺失字段给默认值；数组截断到上限（3/3/5）", () => {
    const raw = JSON.stringify({
      highlights: Array.from({ length: 5 }, (_, i) => ({ en: `e${i}`, note: `n${i}` })),
      improvements: "not-an-array",
      memoryUpdate: { add: Array.from({ length: 8 }, (_, i) => `f${i}`) },
    });
    const result = parseSummaryResponse(raw);
    expect(result.summary.highlights).toHaveLength(3);
    expect(result.summary.improvements).toEqual([]);
    expect(result.memoryUpdate.add).toHaveLength(5);
    expect(result.memoryUpdate.remove).toEqual([]);
    expect(result.summary.fluencyComment.length).toBeGreaterThan(0);
  });

  it("过滤缺字段的亮点/改进项与非字符串记忆项", () => {
    const raw = JSON.stringify({
      fluencyComment: "不错！",
      highlights: [{ en: "good" }, { note: "x" }, { en: "ok", note: "好" }],
      improvements: [{ original: "a", better: "b" }],
      memoryUpdate: { add: ["valid", 42], remove: [null, "gone"] },
    });
    const result = parseSummaryResponse(raw);
    expect(result.summary.highlights).toEqual([{ en: "ok", note: "好" }]);
    expect(result.summary.improvements).toEqual([]);
    expect(result.memoryUpdate).toEqual({ add: ["valid"], remove: ["gone"] });
  });

  it("完全非 JSON 时回退为纯文本点评", () => {
    const result = parseSummaryResponse("你今天说得不错，继续加油！");
    expect(result.summary.fluencyComment).toBe("你今天说得不错，继续加油！");
    expect(result.summary.highlights).toEqual([]);
    expect(result.memoryUpdate).toEqual({ add: [], remove: [] });
  });

  it("空输入时给默认点评", () => {
    const result = parseSummaryResponse("   ");
    expect(result.summary.fluencyComment.length).toBeGreaterThan(0);
  });
});
