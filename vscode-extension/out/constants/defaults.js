"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROMPT_TEMPLATES = void 0;
/**
 * Prompt模板默认值配置
 * 这些是配置默认值，不是业务逻辑代码
 * 当VS Code配置schema默认值不可用时作为fallback
 *
 * 注意：这些值与package.json中的默认值保持一致
 */
exports.DEFAULT_PROMPT_TEMPLATES = {
    system: '你是一个专业的英文语言评估专家。请分析英文文本的难度，并返回结构化的评估结果。',
    user: `请分析以下英文文本的难度，并返回JSON格式的结果：

文本内容：
"""
{text}
"""

请提供以下信息的JSON响应：
1. difficultyLevel: 难度等级（Beginner/Intermediate/Advanced/Expert）
2. cefrLevel: CEFR等级（A1/A2/B1/B2/C1/C2）
3. score: 综合分数（0-100）
4. vocabularyComplexity: 词汇复杂度分析，包含：
   - rareWordCount: 罕见词数量
   - academicWordCount: 学术词汇数量
   - avgWordLength: 平均词长
   - uniqueWordRatio: 唯一词比例（0-1）
   - readabilityScore: 可读性分数（0-100）
5. sentenceComplexity: 句子复杂度分析，包含：
   - avgSentenceLength: 平均句长（词数）
   - complexSentenceRatio: 复杂句式比例（0-1）
   - avgClausesPerSentence: 每句平均子句数
   - passiveVoiceRatio: 被动语态比例（0-1）
6. estimatedReadingTime: 预计阅读时间（分钟）
7. suggestions: 改进建议数组（至少3条）

请确保返回纯JSON格式，不要包含其他文本。`
};
//# sourceMappingURL=defaults.js.map