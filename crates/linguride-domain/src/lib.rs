use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextAnalysisHighlight {
    pub title: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextAnalysisMetrics {
    pub character_count: usize,
    pub word_count: usize,
    pub sentence_count: usize,
    pub paragraph_count: usize,
    pub average_word_length: f32,
    pub average_sentence_length: f32,
    pub estimated_reading_minutes: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextAnalysisSummary {
    pub normalized_text: String,
    pub excerpt: String,
    pub metrics: TextAnalysisMetrics,
    pub highlights: Vec<TextAnalysisHighlight>,
}
