import { describe, expect, it } from "vitest";

import { JsLiteralSyntaxError, parseJsLiteral } from "./jsLiteral";

describe("parseJsLiteral", () => {
  it("解析对象：裸键 + 字符串值 + 尾逗号", () => {
    expect(parseJsLiteral('{ type: "scene", tag: "SCENE 1", }')).toEqual({
      type: "scene",
      tag: "SCENE 1",
    });
  });

  it("解析嵌套数组与对象", () => {
    const src = `[
      { type: "title", emoji: "🌈", title: "Hi", sub: "x" },
      { type: "scene", lines: [ { who: "mom", text: "Good morning." }, ] },
    ]`;
    expect(parseJsLiteral(src)).toEqual([
      { type: "title", emoji: "🌈", title: "Hi", sub: "x" },
      { type: "scene", lines: [{ who: "mom", text: "Good morning." }] },
    ]);
  });

  it("解析数字、布尔、null", () => {
    expect(parseJsLiteral('{ a: 12, b: -3.5, c: true, d: false, e: null }')).toEqual({
      a: 12,
      b: -3.5,
      c: true,
      d: false,
      e: null,
    });
  });

  it("解析转义与 emoji/中文", () => {
    expect(parseJsLiteral('"a\\"b\\n\\u0041"')).toBe('a"b\nA');
    expect(parseJsLiteral('"🌞🐓 中文"')).toBe("🌞🐓 中文");
  });

  it("跳过行注释与块注释", () => {
    expect(parseJsLiteral("{\n // 注释\n a: 1, /* 块 */ b: 2 }")).toEqual({ a: 1, b: 2 });
  });

  it("空数组空对象", () => {
    expect(parseJsLiteral("[]")).toEqual([]);
    expect(parseJsLiteral("{}")).toEqual({});
  });

  it("拒绝未闭合字符串", () => {
    expect(() => parseJsLiteral('"abc')).toThrow(JsLiteralSyntaxError);
  });

  it("拒绝多余内容", () => {
    expect(() => parseJsLiteral("[] []")).toThrow(JsLiteralSyntaxError);
  });

  it("拒绝单引号字符串", () => {
    expect(() => parseJsLiteral("{ a: 'x' }")).toThrow(JsLiteralSyntaxError);
  });

  it("错误信息携带位置", () => {
    try {
      parseJsLiteral("{ a 1 }");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(JsLiteralSyntaxError);
      expect((e as JsLiteralSyntaxError).position).toBeGreaterThan(0);
    }
  });
});
