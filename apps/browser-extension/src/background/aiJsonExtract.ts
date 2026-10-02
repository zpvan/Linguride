/**
 * @file aiJsonExtract.ts
 * @description 从 AI 回复中提取 JSON 文本的小工具
 *
 * 处理模型常见的 ```json 代码围栏与首尾杂散文字。
 * 与 service-worker 内既有 handler 的正则回退策略一致，
 * 抽成独立模块供语伴各解析器复用。
 *
 * @author Lingride Team
 * @since 1.1.0
 */

/**
 * 提取 JSON 文本：优先取 ``` 围栏内的内容，否则返回原文（trim）。
 */
export function extractJsonText(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return raw.trim();
}
