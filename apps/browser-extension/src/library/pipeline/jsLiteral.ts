/**
 * @file jsLiteral.ts
 * @description 受限 JS 字面量解析器：仅支持字符串（双引号）/数字/布尔/null/数组/对象
 * （裸标识符或字符串键），允许尾逗号与行/块注释。
 * 不执行任何代码，用于安全解析 story-ppt 的 SLIDES 数据数组。
 */

export class JsLiteralSyntaxError extends Error {
  constructor(
    message: string,
    public readonly position: number
  ) {
    super(`${message}（位置 ${position}）`);
    this.name = "JsLiteralSyntaxError";
  }
}

export function parseJsLiteral(source: string): unknown {
  let pos = 0;

  function error(message: string): never {
    throw new JsLiteralSyntaxError(message, pos);
  }

  function skipTrivia(): void {
    while (pos < source.length) {
      const ch = source[pos];
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
        pos++;
        continue;
      }
      if (ch === "/" && source[pos + 1] === "/") {
        while (pos < source.length && source[pos] !== "\n") pos++;
        continue;
      }
      if (ch === "/" && source[pos + 1] === "*") {
        const end = source.indexOf("*/", pos + 2);
        if (end === -1) error("块注释未闭合");
        pos = end + 2;
        continue;
      }
      break;
    }
  }

  function parseValue(): unknown {
    skipTrivia();
    const ch = source[pos];
    if (ch === '"') return parseString();
    if (ch === "[") return parseArray();
    if (ch === "{") return parseObject();
    if (ch === "-" || (ch >= "0" && ch <= "9")) return parseNumber();
    if (source.startsWith("true", pos)) {
      pos += 4;
      return true;
    }
    if (source.startsWith("false", pos)) {
      pos += 5;
      return false;
    }
    if (source.startsWith("null", pos)) {
      pos += 4;
      return null;
    }
    error(`无法识别的值：${source.slice(pos, pos + 12)}`);
  }

  function parseString(): string {
    pos++; // 跳过开引号
    let result = "";
    while (pos < source.length) {
      const ch = source[pos];
      if (ch === '"') {
        pos++;
        return result;
      }
      if (ch === "\\") {
        const next = source[pos + 1];
        switch (next) {
          case '"':
            result += '"';
            break;
          case "\\":
            result += "\\";
            break;
          case "n":
            result += "\n";
            break;
          case "t":
            result += "\t";
            break;
          case "r":
            result += "\r";
            break;
          case "u": {
            const hex = source.slice(pos + 2, pos + 6);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) error("非法 \\u 转义");
            result += String.fromCharCode(parseInt(hex, 16));
            pos += 6;
            continue;
          }
          default:
            error(`不支持的转义 \\${next}`);
        }
        pos += 2;
        continue;
      }
      result += ch;
      pos++;
    }
    error("字符串未闭合");
  }

  function parseNumber(): number {
    const match = /^-?\d+(\.\d+)?/.exec(source.slice(pos));
    if (!match) error("非法数字");
    pos += match[0].length;
    return Number(match[0]);
  }

  function parseArray(): unknown[] {
    pos++; // [
    const items: unknown[] = [];
    for (;;) {
      skipTrivia();
      if (source[pos] === "]") {
        pos++;
        return items;
      }
      items.push(parseValue());
      skipTrivia();
      if (source[pos] === ",") {
        pos++;
        continue;
      }
      if (source[pos] === "]") {
        pos++;
        return items;
      }
      error("数组元素后应为逗号或 ]");
    }
  }

  function parseObject(): Record<string, unknown> {
    pos++; // {
    const obj: Record<string, unknown> = {};
    for (;;) {
      skipTrivia();
      if (source[pos] === "}") {
        pos++;
        return obj;
      }
      let key: string;
      if (source[pos] === '"') {
        key = parseString();
      } else {
        const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(pos));
        if (!match) error("对象键应为标识符或字符串");
        key = match[0];
        pos += match[0].length;
      }
      skipTrivia();
      if (source[pos] !== ":") error("对象键后应为冒号");
      pos++;
      obj[key] = parseValue();
      skipTrivia();
      if (source[pos] === ",") {
        pos++;
        continue;
      }
      if (source[pos] === "}") {
        pos++;
        return obj;
      }
      error("对象属性后应为逗号或 }");
    }
  }

  const value = parseValue();
  skipTrivia();
  if (pos !== source.length) error("字面量结束后存在多余内容");
  return value;
}
