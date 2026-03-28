/**
 * Prompt模板默认值配置
 * 这些是配置默认值，不是业务逻辑代码
 * 当VS Code配置schema默认值不可用时作为fallback
 *
 * 注意：这些值与package.json中的默认值保持一致
 */
export declare const DEFAULT_PROMPT_TEMPLATES: {
    readonly system: "你是一个专业的英文语言评估专家。请分析英文文本的难度，并返回结构化的评估结果。";
    readonly user: "请分析以下英文文本的难度，并返回JSON格式的结果：\n\n文本内容：\n\"\"\"\n{text}\n\"\"\"\n\n请提供以下信息的JSON响应：\n1. difficultyLevel: 难度等级（Beginner/Intermediate/Advanced/Expert）\n2. cefrLevel: CEFR等级（A1/A2/B1/B2/C1/C2）\n3. score: 综合分数（0-100）\n4. vocabularyComplexity: 词汇复杂度分析，包含：\n   - rareWordCount: 罕见词数量\n   - academicWordCount: 学术词汇数量\n   - avgWordLength: 平均词长\n   - uniqueWordRatio: 唯一词比例（0-1）\n   - readabilityScore: 可读性分数（0-100）\n5. sentenceComplexity: 句子复杂度分析，包含：\n   - avgSentenceLength: 平均句长（词数）\n   - complexSentenceRatio: 复杂句式比例（0-1）\n   - avgClausesPerSentence: 每句平均子句数\n   - passiveVoiceRatio: 被动语态比例（0-1）\n6. estimatedReadingTime: 预计阅读时间（分钟）\n7. suggestions: 改进建议数组（至少3条）\n\n请确保返回纯JSON格式，不要包含其他文本。";
};
//# sourceMappingURL=defaults.d.ts.map