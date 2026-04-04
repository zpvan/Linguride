import type { ExtensionConfig, PromptTemplates } from "@linguride/contracts-ts";

export interface SupportedVariable {
  name: string;
  description: string;
  example: string;
}

export interface TemplateValidationResult {
  isValid: boolean;
  missingPlaceholders: string[];
}

export interface PromptConfigValidationResult {
  isValid: boolean;
  missingConfigs: string[];
}

export type PromptVariableValue = string | number | boolean | Date | null | undefined;
export type PromptVariableMap = Record<string, PromptVariableValue>;

export interface UserPromptOptions {
  text: string;
  providerId: string;
  config: ExtensionConfig;
  language?: string;
  fallbackTemplates: Required<PromptTemplates>;
  variables?: PromptVariableMap;
}

function toPromptValue(value: PromptVariableValue): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function renderTemplate(
  template: string,
  variables: PromptVariableMap
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(
      new RegExp(escapeRegExp(placeholder), "g"),
      toPromptValue(value)
    );
  }

  return result;
}

export function resolvePromptTemplates(
  providerId: string,
  config: ExtensionConfig,
  fallbackTemplates: Required<PromptTemplates>
): Required<PromptTemplates> {
  const providerConfig = config.providers[providerId as keyof typeof config.providers];

  return {
    system:
      providerConfig?.promptTemplates?.system ||
      config.analysis.promptTemplates?.system ||
      fallbackTemplates.system,
    user:
      providerConfig?.promptTemplates?.user ||
      config.analysis.promptTemplates?.user ||
      fallbackTemplates.user,
  };
}

export function getSystemPrompt(
  providerId: string,
  config: ExtensionConfig,
  fallbackTemplates: Required<PromptTemplates>
): string {
  return resolvePromptTemplates(providerId, config, fallbackTemplates).system;
}

export function getUserPrompt(options: UserPromptOptions): string {
  const {
    config,
    fallbackTemplates,
    language = "en",
    providerId,
    text,
    variables = {},
  } = options;

  const templates = resolvePromptTemplates(providerId, config, fallbackTemplates);

  return renderTemplate(templates.user, {
    text,
    language,
    date: new Date().toISOString().split("T")[0],
    ...variables,
  });
}

export function validateTemplate(
  template: string,
  requiredPlaceholders: string[] = ["text"]
): TemplateValidationResult {
  const missingPlaceholders = requiredPlaceholders.filter((placeholder) => {
    const regex = new RegExp(`\\{${escapeRegExp(placeholder)}\\}`);
    return !regex.test(template);
  });

  return {
    isValid: missingPlaceholders.length === 0,
    missingPlaceholders,
  };
}

export function getSupportedVariables(): SupportedVariable[] {
  return [
    {
      name: "text",
      description: "用户输入的英文文本",
      example: "{text}",
    },
    {
      name: "language",
      description: "分析语言代码",
      example: "{language}",
    },
    {
      name: "date",
      description: "当前日期（YYYY-MM-DD格式）",
      example: "{date}",
    },
  ];
}

export function validatePromptConfig(
  config: ExtensionConfig,
  providerId: string,
  fallbackTemplates: Required<PromptTemplates>
): PromptConfigValidationResult {
  const templates = resolvePromptTemplates(providerId, config, fallbackTemplates);
  const missingConfigs: string[] = [];

  if (!templates.system.trim()) {
    missingConfigs.push("系统提示模板");
  }

  if (!templates.user.trim()) {
    missingConfigs.push("用户提示模板");
  }

  return {
    isValid: missingConfigs.length === 0,
    missingConfigs,
  };
}
