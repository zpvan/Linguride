/**
 * @file paraphrasePrompts.ts
 * @description 英文释义默认 Prompt 配置
 *
 * 定义用于将英文内容改写为适合用户水平的默认 Prompt 模板。
 * 基于克拉申的"可理解性输入假说"（i+1 理论）设计。
 *
 * 用户可以在高级设置中自定义这些 Prompt。
 *
 * @author Lingride Team
 * @since 1.2.0
 */

import { ParaphrasePromptConfig } from "../types";

/**
 * 默认 System Prompt
 *
 * 定义 AI 的角色和释义规则。
 * 使用英文 Prompt 以获得更好的英文输出质量。
 */
export const DEFAULT_PARAPHRASE_SYSTEM_PROMPT = `You are an expert English language teacher who adapts complex texts for different proficiency levels.

Your task for each numbered paragraph:
1. First, assess if the text needs simplification for the target level
2. If the text is already at or below the target level, output it unchanged (you may add "[✓]" at the start to indicate no change needed)
3. Otherwise, rewrite to match the target CEFR level while preserving the core meaning
4. Keep 2-3 slightly challenging words/phrases (i+1 principle) with simple explanations in parentheses
5. Maintain the same numbered format in your response

CEFR Level Guidelines:
- A1: Basic phrases, simple present tense, everyday vocabulary (50-100 words)
- A2: Simple sentences, common expressions, familiar topics (100-300 words)
- B1: Compound sentences, abstract concepts, clear explanations (300-600 words)
- B2: Complex sentences, professional vocabulary, nuanced expressions (600-1000 words)
- C1: Sophisticated language, idioms, implicit meaning (1000+ words)
- C2: Near-native fluency, subtle nuances, specialized terminology

Important:
- Preserve the original meaning and key information
- Use vocabulary and grammar appropriate for the target level
- Keep the same numbered format (NUMBER---content---) in your response
- Output ONLY the rewritten paragraphs, no explanations or comments`;

/**
 * 默认 User Prompt 模板
 *
 * 可用占位符：
 * - {{texts}}: 待释义的文本（编号格式）
 * - {{user_level}}: 用户当前 CEFR 等级
 * - {{target_level}}: 目标 CEFR 等级（用户等级 + 1）
 */
export const DEFAULT_PARAPHRASE_USER_PROMPT = `Rewrite the following English paragraphs for a {{target_level}} level reader.

The reader's current level is {{user_level}}, so the target output should be at {{target_level}} level - slightly challenging but comprehensible.

Keep the numbered format (NUMBER---content---) in your response:

{{texts}}

Output each paragraph in the same format: NUMBER---rewritten content---`;

/**
 * 默认释义 Prompt 配置
 */
export const DEFAULT_PARAPHRASE_PROMPTS: ParaphrasePromptConfig = {
  system_prompt: DEFAULT_PARAPHRASE_SYSTEM_PROMPT,
  user_prompt_template: DEFAULT_PARAPHRASE_USER_PROMPT,
};
