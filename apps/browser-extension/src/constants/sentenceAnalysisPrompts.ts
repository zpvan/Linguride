/**
 * @file sentenceAnalysisPrompts.ts
 * @description 长难句分析默认 Prompt 配置
 *
 * 定义用于英文长难句结构化分析的默认 Prompt 模板。
 * 用户可以在设置面板中自定义这些 Prompt。
 *
 * 分析维度：
 * - 中文翻译
 * - 句子主干（主语/谓语/宾语/补语）
 * - 从句拆解（类型/内容/功能）
 * - 重点短语/词汇
 * - 语法要点
 * - 简化改写
 *
 * @author Lingride Team
 * @since 1.2.0
 */

import { SentenceAnalysisPromptConfig } from "../types";

/**
 * 默认 System Prompt
 *
 * 定义 AI 的角色为英语语法分析专家，
 * 擅长拆解复杂句式、识别从句结构和语法要点。
 */
export const DEFAULT_SENTENCE_ANALYSIS_SYSTEM_PROMPT = `你是一位专业的英语语法分析专家，擅长拆解英文长难句的结构。你的任务是帮助英语学习者理解复杂句子的句法结构、语法要点和核心含义。

分析原则：
1. 准确识别句子主干（主语、谓语、宾语/补语）
2. 精确划分从句类型及其在句中的功能
3. 提炼对理解句意最关键的短语和词汇
4. 语法要点要贴合该句的实际难点，不要泛泛而谈
5. 简化改写要保持原意，使用简单直白的英语

请始终以纯 JSON 格式返回结果，不要包含 markdown 代码块或其他文本。`;

/**
 * 默认 User Prompt 模板
 *
 * {{sentence}} 占位符将被替换为用户输入的待分析句子。
 */
export const DEFAULT_SENTENCE_ANALYSIS_USER_PROMPT = `请对以下英文句子进行结构化分析，返回 JSON 格式的结果：

句子：
"""
{{sentence}}
"""

请严格按照以下 JSON 结构返回（不要包含 markdown 代码块）：

{
  "translation": "准确、自然的中文翻译",
  "structure": {
    "subject": "句子的主语部分",
    "predicate": "句子的谓语部分（含助动词/情态动词）",
    "object": "句子的宾语部分（如无宾语则省略此字段）",
    "complement": "句子的补语部分（如无补语则省略此字段）"
  },
  "clauses": [
    {
      "type": "从句类型（如：定语从句、状语从句、宾语从句、主语从句、同位语从句、条件状语从句等）",
      "content": "从句的完整内容",
      "function": "该从句在主句中的功能说明"
    }
  ],
  "keyPhrases": [
    {
      "phrase": "重点短语或词汇",
      "meaning": "中文释义及用法说明"
    }
  ],
  "grammarPoints": [
    "语法要点1：具体说明该句中涉及的语法现象",
    "语法要点2：..."
  ],
  "simplifiedVersion": "用简单英语改写的版本（A2-B1 水平可理解）"
}

要求：
1. 如果是简单句（无从句），clauses 返回空数组 []
2. 如果句子没有宾语（不及物动词），structure 中不要包含 object 字段
3. 如果句子没有补语，structure 中不要包含 complement 字段
4. keyPhrases 至少提取 2-3 个对理解句意最关键的短语
5. grammarPoints 至少列出 2 个该句涉及的语法要点
6. simplifiedVersion 要用简单英语改写，保持原意但降低理解难度`;

/**
 * 默认长难句分析 Prompt 配置
 */
export const DEFAULT_SENTENCE_ANALYSIS_PROMPTS: SentenceAnalysisPromptConfig = {
  system_prompt: DEFAULT_SENTENCE_ANALYSIS_SYSTEM_PROMPT,
  user_prompt_template: DEFAULT_SENTENCE_ANALYSIS_USER_PROMPT,
};
