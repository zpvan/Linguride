/**
 * @file difficultyPrompts.ts
 * @description 难度分析默认 Prompt 配置
 *
 * 定义用于英文难度分析的默认 Prompt 模板。
 * 用户可以在高级设置中自定义这些 Prompt。
 *
 * 参考 VSCode 扩展的 defaults.ts 设计。
 *
 * @author Lingride Team
 * @since 1.1.0
 */

import { DifficultyPromptConfig } from "../types";

/**
 * 默认 System Prompt
 *
 * 定义 AI 的角色和分析方式。
 */
export const DEFAULT_DIFFICULTY_SYSTEM_PROMPT = `你是一个专业的英文语言评估专家。请分析英文文本的难度，并返回结构化的评估结果。

评估标准：
1. 难度等级基于词汇复杂度、句子结构和主题专业性
2. CEFR 等级遵循欧洲共同语言参考标准
3. 综合分数反映整体阅读难度（0-100，分数越高越难）
4. 建议应针对学习者实际需求`;

/**
 * 默认 User Prompt 模板
 *
 * {text} 占位符将被替换为实际的待分析文本。
 */
export const DEFAULT_DIFFICULTY_USER_PROMPT = `请分析以下英文文本的难度，并返回JSON格式的结果：

文本内容：
"""
{text}
"""

请提供以下信息的JSON响应：
1. difficultyLevel: 难度等级（Beginner/Intermediate/Advanced/Expert）
2. cefrLevel: CEFR等级（A1/A2/B1/B2/C1/C2）
3. score: 综合分数（0-100，分数越高越难）
4. vocabularyComplexity: 词汇复杂度分析，包含：
   - rareWordCount: 罕见词数量
   - academicWordCount: 学术词汇数量
   - avgWordLength: 平均词长
5. sentenceComplexity: 句子复杂度分析，包含：
   - avgSentenceLength: 平均句长（词数）
   - complexSentenceRatio: 复杂句式比例（0-1）
6. estimatedReadingTime: 预计阅读时间（分钟）
7. suggestions: 针对学习者的建议数组（至少2条）

请确保返回纯JSON格式，不要包含markdown代码块或其他文本。`;

/**
 * 默认难度分析 Prompt 配置
 */
export const DEFAULT_DIFFICULTY_PROMPTS: DifficultyPromptConfig = {
  system_prompt: DEFAULT_DIFFICULTY_SYSTEM_PROMPT,
  user_prompt_template: DEFAULT_DIFFICULTY_USER_PROMPT,
};
