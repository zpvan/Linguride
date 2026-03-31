use serde::{Deserialize, Serialize};

use crate::config::CefrLevel;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ReaderMode {
    Translate,
    Paraphrase,
    Mixed,
}

impl Default for ReaderMode {
    fn default() -> Self {
        Self::Translate
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DifficultyTier {
    Foundation,
    Guided,
    Stretch,
    Intensive,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReaderBlock {
    pub id: String,
    pub original_text: String,
    pub rendered_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReaderDocument {
    pub capture_id: String,
    pub title: String,
    pub origin_url: Option<String>,
    pub mode: ReaderMode,
    pub blocks: Vec<ReaderBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DifficultyReport {
    pub tier: DifficultyTier,
    pub cefr_level: CefrLevel,
    pub score: u8,
    pub reading_time_minutes: f32,
    pub suggestions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReaderResult {
    pub document: ReaderDocument,
    pub difficulty: DifficultyReport,
    pub summary: TextAnalysisSummary,
}

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
