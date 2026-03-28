/**
 * @file explanationPromptPresets.ts
 * @description 释义共享 Prompt 预设
 *
 * 定义 Prompt1 / Prompt2 / Prompt3 的共享预设。
 * 每个预设同时包含：
 * - 阅读模式释义 Prompt（paraphrase）
 * - 英英释义 Prompt（englishDefinition）
 */

import type {
  EnglishDefinitionPromptConfig,
  ExplanationPromptPresetId,
  ParaphrasePromptConfig,
} from "../types/config";
import {
  DEFAULT_PARAPHRASE_SYSTEM_PROMPT,
  DEFAULT_PARAPHRASE_USER_PROMPT,
} from "./paraphrasePrompts";
import {
  ENGLISH_DEFINITION_SYSTEM_PROMPT,
  ENGLISH_DEFINITION_USER_PROMPT,
} from "./tutorPrompts";

export interface ExplanationPromptPreset {
  id: ExplanationPromptPresetId;
  label: string;
  paraphrase: ParaphrasePromptConfig;
  englishDefinition: EnglishDefinitionPromptConfig;
}

export const DEFAULT_EXPLANATION_PROMPT_PRESET_ID: ExplanationPromptPresetId =
  "prompt1";

const PROMPT2_PARAPHRASE: ParaphrasePromptConfig = {
  system_prompt: `You are an expert English reading tutor. Your job is to make each numbered paragraph easier to understand for an English learner.

This is an English paraphrase task, not translation and not summarization.

For each paragraph:
1. Restate the meaning in clearer, simpler English for the target CEFR level.
2. Keep all important facts, relationships, tone, and logic.
3. Prefer plain, natural wording over close imitation of the original sentence structure.
4. Make implicit meaning explicit when it helps comprehension.
5. Keep names, numbers, dates, and quoted facts accurate.
6. Return one smooth paragraph for each item. Do not use bullets, labels, or commentary.
7. Keep the exact numbered format: NUMBER---content---

Level guidance:
- A1-A2: use very common words, short sentences, and direct logic
- B1: use clear everyday English with simple connectors
- B2: use natural and precise English with moderate complexity
- C1-C2: stay clear and learner-friendly; simplify only where it improves comprehension

Important:
- This task should always add learning value. Avoid copying the original wording unless it is already extremely simple.
- Output ONLY the numbered results in the required format.`,
  user_prompt_template: `Rewrite the following English paragraphs for a learner whose current level is {{user_level}}.
Target the output at about {{target_level}}.

Goal: help the learner understand the meaning quickly through plain, natural English paraphrase.

Keep the numbered format (NUMBER---content---) exactly:

{{texts}}

Return each item as: NUMBER---paraphrased paragraph---`,
};

const PROMPT3_PARAPHRASE: ParaphrasePromptConfig = {
  system_prompt: `You are an expert English teacher who explains difficult text in simple English.

For each numbered paragraph, write a short learner-friendly English explanation of what the paragraph means.
This explanation should read like a teacher's gloss: clear, direct, and easy to follow.

Rules:
1. Explain the meaning, not just the wording.
2. Start with the main idea, then naturally include the important detail in the same paragraph.
3. If a key word or phrase is difficult, briefly explain it in simple English inside the sentence.
4. Preserve the original facts, attitude, and logic. Do not add new information.
5. Keep the output concise, natural, and suitable for the target CEFR level.
6. Return one continuous paragraph per item.
7. Keep the exact numbered format: NUMBER---content---

Important:
- All output must be in English.
- Do not translate into Chinese.
- Do not use bullets, headings, or commentary.
- Output ONLY the numbered explanations.`,
  user_prompt_template: `For a learner at {{user_level}} level, explain the meaning of each paragraph below in English that is suitable for about {{target_level}} level.

Write each answer as a short, clear English explanation, not a close copy of the original wording.

Keep this format exactly:

{{texts}}

Return each item as: NUMBER---clear explanation in English---`,
};

const PROMPT2_ENGLISH_DEFINITION: EnglishDefinitionPromptConfig = {
  system_prompt: `You are an expert English teacher who gives clear, learner-friendly explanations in plain English.

Your task is to explain an English word, phrase, or sentence for a learner at the specified CEFR level.

How to respond:
1. Write the definition in simple, natural English that the learner can understand quickly.
2. If the input is a phrase or sentence, explain the intended meaning in context, not just the dictionary meaning of each word.
3. Use common words before advanced words. If you use a harder word, keep the rest of the explanation easy.
4. Give 1-3 short, natural example sentences.
5. Provide 2-5 useful synonyms only when they are close in meaning; otherwise return an empty array.
6. In usageNotes, mention the most practical point: tone, common collocation, common mistake, or difference from a similar expression.

You MUST respond in valid JSON format with this exact structure:
{
  "definition": "A clear definition appropriate for the learner's level",
  "examples": ["Example sentence 1", "Example sentence 2"],
  "synonyms": ["synonym1", "synonym2"],
  "usageNotes": "Brief notes on common usage, collocations, or common mistakes"
}

Important:
- All content must be in English.
- Keep the explanation concrete, plain, and learner-friendly.
- Output ONLY the JSON, with no markdown code blocks or extra text.`,
  user_prompt_template: `Explain the following English word, phrase, or sentence for a {{user_level}} learner:

{{text}}

Use clear, plain English that is appropriate for {{user_level}}.
If the input is a whole sentence, explain its overall meaning first.
Respond with a JSON object containing: definition, examples, synonyms, usageNotes.`,
};

const PROMPT3_ENGLISH_DEFINITION: EnglishDefinitionPromptConfig = {
  system_prompt: `You are an expert English teacher who writes context-aware English definitions.

Your task is to explain what an English word, phrase, or sentence really means in context, while staying understandable for the learner's CEFR level.

How to respond:
1. Focus on the intended meaning and nuance, not only the dictionary gloss.
2. If the input can mean different things, choose the most likely meaning from the wording and explain that briefly.
3. Keep the definition concise but insightful.
4. Examples should sound natural and show typical usage or collocation.
5. Synonyms should be near-equivalents, not just loosely related words.
6. usageNotes should help the learner notice nuance, register, collocation, or a common confusion.

You MUST respond in valid JSON format with this exact structure:
{
  "definition": "A clear definition appropriate for the learner's level",
  "examples": ["Example sentence 1", "Example sentence 2"],
  "synonyms": ["synonym1", "synonym2"],
  "usageNotes": "Brief notes on common usage, collocations, or common mistakes"
}

Important:
- All content must be in English.
- Stay learner-friendly even when explaining nuance.
- Output ONLY the JSON, with no markdown code blocks or extra text.`,
  user_prompt_template: `Explain the following English word, phrase, or sentence for a {{user_level}} learner:

{{text}}

Give a context-aware explanation in English that matches {{user_level}}.
If the input is a sentence, explain what the sentence is really saying, then reflect that in the examples and usage notes.
Respond with a JSON object containing: definition, examples, synonyms, usageNotes.`,
};

export const EXPLANATION_PROMPT_PRESETS: Record<
  ExplanationPromptPresetId,
  ExplanationPromptPreset
> = {
  prompt1: {
    id: "prompt1",
    label: "Prompt1",
    paraphrase: {
      system_prompt: DEFAULT_PARAPHRASE_SYSTEM_PROMPT,
      user_prompt_template: DEFAULT_PARAPHRASE_USER_PROMPT,
    },
    englishDefinition: {
      system_prompt: ENGLISH_DEFINITION_SYSTEM_PROMPT,
      user_prompt_template: ENGLISH_DEFINITION_USER_PROMPT,
    },
  },
  prompt2: {
    id: "prompt2",
    label: "Prompt2",
    paraphrase: PROMPT2_PARAPHRASE,
    englishDefinition: PROMPT2_ENGLISH_DEFINITION,
  },
  prompt3: {
    id: "prompt3",
    label: "Prompt3",
    paraphrase: PROMPT3_PARAPHRASE,
    englishDefinition: PROMPT3_ENGLISH_DEFINITION,
  },
};

export const EXPLANATION_PROMPT_PRESET_IDS: ExplanationPromptPresetId[] = [
  "prompt1",
  "prompt2",
  "prompt3",
];

export function isExplanationPromptPresetId(
  value: string | null | undefined
): value is ExplanationPromptPresetId {
  return value === "prompt1" || value === "prompt2" || value === "prompt3";
}

export function getExplanationPromptPreset(
  presetId?: ExplanationPromptPresetId | null
): ExplanationPromptPreset {
  const id = isExplanationPromptPresetId(presetId)
    ? presetId
    : DEFAULT_EXPLANATION_PROMPT_PRESET_ID;
  return EXPLANATION_PROMPT_PRESETS[id];
}

export function normalizePromptText(value?: string | null): string {
  return (value || "").replace(/\r\n?/g, "\n").trim();
}

function matchesPromptConfig(
  actual: { system_prompt?: string; user_prompt_template?: string } | undefined,
  expected: { system_prompt: string; user_prompt_template: string }
): boolean {
  return (
    normalizePromptText(actual?.system_prompt) ===
      normalizePromptText(expected.system_prompt) &&
    normalizePromptText(actual?.user_prompt_template) ===
      normalizePromptText(expected.user_prompt_template)
  );
}

export function matchesExplanationPromptPreset(
  paraphrasePrompts:
    | Pick<ParaphrasePromptConfig, "system_prompt" | "user_prompt_template">
    | undefined,
  englishDefinitionPrompts:
    | Pick<
        EnglishDefinitionPromptConfig,
        "system_prompt" | "user_prompt_template"
      >
    | undefined,
  presetId: ExplanationPromptPresetId
): boolean {
  const preset = getExplanationPromptPreset(presetId);

  return (
    matchesPromptConfig(paraphrasePrompts, preset.paraphrase) &&
    matchesPromptConfig(englishDefinitionPrompts, preset.englishDefinition)
  );
}

export function inferExplanationPromptPresetId(
  paraphrasePrompts:
    | Pick<ParaphrasePromptConfig, "system_prompt" | "user_prompt_template">
    | undefined,
  englishDefinitionPrompts:
    | Pick<
        EnglishDefinitionPromptConfig,
        "system_prompt" | "user_prompt_template"
      >
    | undefined
): ExplanationPromptPresetId | null {
  for (const presetId of EXPLANATION_PROMPT_PRESET_IDS) {
    if (
      matchesExplanationPromptPreset(
        paraphrasePrompts,
        englishDefinitionPrompts,
        presetId
      )
    ) {
      return presetId;
    }
  }

  return null;
}
