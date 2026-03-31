import { invoke } from "@tauri-apps/api/core";

import type { TextAnalysisSummary } from "../types/rustCore";

export function analyzeTextOverview(text: string) {
  return invoke<TextAnalysisSummary>("analyze_text_overview", { text });
}
