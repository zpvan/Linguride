use linguride_domain::{
    CaptureRecord, CefrLevel, DifficultyReport, DifficultyTier, LingurideError,
    LingurideErrorCode, ReaderBlock, ReaderDocument, ReaderMode, ReaderResult,
    TextAnalysisHighlight, TextAnalysisMetrics, TextAnalysisSummary,
};

use crate::support::{make_preview, normalize_text, split_blocks};

const WORDS_PER_MINUTE: f32 = 200.0;

pub fn run_reader_mode(
    capture: &CaptureRecord,
    mode: ReaderMode,
) -> Result<ReaderResult, LingurideError> {
    let text = capture.text.trim();
    if text.is_empty() {
        return Err(LingurideError::new(
            LingurideErrorCode::EmptyText,
            "Reader mode requires captured text.",
        ));
    }

    let summary = analyze_text_overview(text)?;
    let difficulty = analyze_difficulty_from_summary(&summary);
    let blocks = split_blocks(text)
        .into_iter()
        .enumerate()
        .map(|(index, block)| ReaderBlock {
            id: format!("{}-{}", capture.id, index),
            rendered_text: render_block(&block, mode),
            original_text: block,
        })
        .collect::<Vec<_>>();

    Ok(ReaderResult {
        document: ReaderDocument {
            capture_id: capture.id.clone(),
            title: capture.title.clone(),
            origin_url: capture.origin_url.clone(),
            mode,
            blocks,
        },
        difficulty,
        summary,
    })
}

pub fn analyze_text_overview(text: &str) -> Result<TextAnalysisSummary, LingurideError> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err(LingurideError::new(
            LingurideErrorCode::EmptyText,
            "Text analysis requires at least one non-empty line.",
        ));
    }

    let normalized_text = normalize_text(trimmed);
    let words = split_words(&normalized_text);
    let sentences = split_sentences(trimmed);
    let paragraph_count = count_paragraphs(trimmed);
    let average_word_length = average_word_length(&words);
    let average_sentence_length = average_sentence_length(&words, &sentences);
    let estimated_reading_minutes = round_to((words.len() as f32 / WORDS_PER_MINUTE).max(0.1), 1);

    let metrics = TextAnalysisMetrics {
        character_count: trimmed.chars().count(),
        word_count: words.len(),
        sentence_count: sentences.len().max(1),
        paragraph_count,
        average_word_length: round_to(average_word_length, 1),
        average_sentence_length: round_to(average_sentence_length, 1),
        estimated_reading_minutes,
    };

    Ok(TextAnalysisSummary {
        excerpt: make_preview(trimmed, 180),
        normalized_text,
        highlights: build_highlights(&words, &sentences, &metrics),
        metrics,
    })
}

fn analyze_difficulty_from_summary(summary: &TextAnalysisSummary) -> DifficultyReport {
    let metrics = &summary.metrics;
    let score = ((metrics.average_sentence_length * 2.2)
        + (metrics.average_word_length * 8.0)
        + (metrics.word_count.min(160) as f32 / 8.0))
        .round()
        .clamp(0.0, 100.0) as u8;

    let (tier, cefr_level) = match score {
        0..=30 => (DifficultyTier::Foundation, CefrLevel::A2),
        31..=55 => (DifficultyTier::Guided, CefrLevel::B1),
        56..=75 => (DifficultyTier::Stretch, CefrLevel::B2),
        _ => (DifficultyTier::Intensive, CefrLevel::C1),
    };

    let suggestions = match tier {
        DifficultyTier::Foundation => vec![
            "保持原文阅读节奏，优先建立熟悉度。".into(),
            "把重点放在高频词与基础句型复现上。".into(),
        ],
        DifficultyTier::Guided => vec![
            "先看混杂模式，再回到原文做二次通读。".into(),
            "挑 2-3 个长句做语镜分析。".into(),
        ],
        DifficultyTier::Stretch => vec![
            "先做长难句拆解，再回读整段。".into(),
            "把不熟悉表达转入 Tutor 做输出练习。".into(),
        ],
        DifficultyTier::Intensive => vec![
            "先缩小到段落级阅读，再进入 Tutor/Corpus 分拆练习。".into(),
            "优先记录生词簇和复杂从句结构。".into(),
        ],
    };

    DifficultyReport {
        tier,
        cefr_level,
        score,
        reading_time_minutes: metrics.estimated_reading_minutes,
        suggestions,
    }
}

fn render_block(text: &str, mode: ReaderMode) -> String {
    match mode {
        ReaderMode::Translate => format!("中文注解待接入：{}", text),
        ReaderMode::Paraphrase => format!("简化释义待接入：{}", text),
        ReaderMode::Mixed => format!("混杂辅助待接入：{}", text),
    }
}

fn split_words(text: &str) -> Vec<String> {
    text.split_whitespace()
        .map(normalize_word)
        .filter(|word| !word.is_empty())
        .collect()
}

fn split_sentences(text: &str) -> Vec<String> {
    text.split(|character| matches!(character, '.' | '!' | '?' | '\n'))
        .map(str::trim)
        .filter(|segment| !segment.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn count_paragraphs(text: &str) -> usize {
    let count = text
        .split("\n\n")
        .map(str::trim)
        .filter(|segment| !segment.is_empty())
        .count();

    count.max(1)
}

fn normalize_word(word: &str) -> String {
    word.trim_matches(|character: char| !character.is_alphanumeric() && character != '\'')
        .to_lowercase()
}

fn average_word_length(words: &[String]) -> f32 {
    if words.is_empty() {
        return 0.0;
    }

    let total_length: usize = words.iter().map(|word| word.chars().count()).sum();
    total_length as f32 / words.len() as f32
}

fn average_sentence_length(words: &[String], sentences: &[String]) -> f32 {
    if words.is_empty() {
        return 0.0;
    }

    let sentence_count = sentences.len().max(1);
    words.len() as f32 / sentence_count as f32
}

fn build_highlights(
    _words: &[String],
    sentences: &[String],
    metrics: &TextAnalysisMetrics,
) -> Vec<TextAnalysisHighlight> {
    let longest_sentence = sentences
        .iter()
        .map(|sentence| split_words(sentence).len())
        .max()
        .unwrap_or(0);

    vec![
        TextAnalysisHighlight {
            title: "Reading load".into(),
            detail: format!(
                "{} words across {} sentences, roughly {} minute(s) to read.",
                metrics.word_count, metrics.sentence_count, metrics.estimated_reading_minutes
            ),
        },
        TextAnalysisHighlight {
            title: "Sentence rhythm".into(),
            detail: if longest_sentence >= 24 {
                format!("The longest sentence runs to {} words.", longest_sentence)
            } else {
                format!(
                    "Average sentence length is {} words.",
                    metrics.average_sentence_length
                )
            },
        },
        TextAnalysisHighlight {
            title: "Vocabulary surface".into(),
            detail: format!(
                "Average word length sits at {} characters.",
                metrics.average_word_length
            ),
        },
    ]
}

fn round_to(value: f32, decimals: u32) -> f32 {
    let factor = 10_f32.powi(decimals as i32);
    (value * factor).round() / factor
}

#[cfg(test)]
mod tests {
    use super::*;
    use linguride_domain::{CaptureSourceApp, CaptureType, PreferredSurface};

    fn capture(text: &str) -> CaptureRecord {
        CaptureRecord {
            id: "capture-1".into(),
            source_app: CaptureSourceApp::ManualInput,
            capture_type: CaptureType::Manual,
            preferred_surface: PreferredSurface::Reader,
            origin_url: Some("https://example.com".into()),
            title: "Sample".into(),
            text: text.into(),
            preview: text.into(),
            content_hash: "hash".into(),
            created_at: 1,
            truncated: false,
        }
    }

    fn summary_with_metrics(
        word_count: usize,
        average_word_length: f32,
        average_sentence_length: f32,
    ) -> TextAnalysisSummary {
        TextAnalysisSummary {
            normalized_text: String::new(),
            excerpt: String::new(),
            highlights: Vec::new(),
            metrics: TextAnalysisMetrics {
                character_count: 0,
                word_count,
                sentence_count: 1,
                paragraph_count: 1,
                average_word_length,
                average_sentence_length,
                estimated_reading_minutes: 0.5,
            },
        }
    }

    #[test]
    fn analyzes_text_overview_metrics_and_normalization() {
        let summary = analyze_text_overview("Don't stop.\n\nKeep going!")
            .expect("analysis should succeed");

        assert_eq!(summary.normalized_text, "Don't stop. Keep going!");
        assert_eq!(summary.metrics.word_count, 4);
        assert_eq!(summary.metrics.sentence_count, 2);
        assert_eq!(summary.metrics.paragraph_count, 2);
        assert_eq!(summary.metrics.average_word_length, 4.5);
        assert_eq!(summary.metrics.average_sentence_length, 2.0);
        assert_eq!(summary.metrics.estimated_reading_minutes, 0.1);
        assert_eq!(summary.highlights.len(), 3);
    }

    #[test]
    fn rejects_empty_text_overview() {
        let error = analyze_text_overview(" \n ").expect_err("empty text should fail");
        assert_eq!(error.code, LingurideErrorCode::EmptyText);
    }

    #[test]
    fn maps_difficulty_tiers_at_boundaries() {
        let cases = [
            (summary_with_metrics(0, 1.0, 10.0), DifficultyTier::Foundation, CefrLevel::A2, 30),
            (summary_with_metrics(8, 1.0, 10.0), DifficultyTier::Guided, CefrLevel::B1, 31),
            (summary_with_metrics(48, 2.0, 15.0), DifficultyTier::Guided, CefrLevel::B1, 55),
            (summary_with_metrics(56, 2.0, 15.0), DifficultyTier::Stretch, CefrLevel::B2, 56),
            (summary_with_metrics(80, 4.0, 15.0), DifficultyTier::Stretch, CefrLevel::B2, 75),
            (summary_with_metrics(88, 4.0, 15.0), DifficultyTier::Intensive, CefrLevel::C1, 76),
        ];

        for (summary, expected_tier, expected_level, expected_score) in cases {
            let difficulty = analyze_difficulty_from_summary(&summary);
            assert_eq!(difficulty.tier, expected_tier);
            assert_eq!(difficulty.cefr_level, expected_level);
            assert_eq!(difficulty.score, expected_score);
            assert_eq!(difficulty.reading_time_minutes, 0.5);
            assert_eq!(difficulty.suggestions.len(), 2);
        }
    }

    #[test]
    fn renders_reader_blocks_for_requested_mode() {
        let result = run_reader_mode(&capture("Paragraph one.\n\nParagraph two."), ReaderMode::Mixed)
            .expect("reader should succeed");

        assert_eq!(result.document.blocks.len(), 2);
        assert_eq!(result.document.blocks[0].id, "capture-1-0");
        assert_eq!(
            result.document.blocks[0].rendered_text,
            "混杂辅助待接入：Paragraph one."
        );
        assert_eq!(result.document.mode, ReaderMode::Mixed);
    }

    #[test]
    fn highlights_longest_sentence_when_it_exceeds_threshold() {
        let text = (0..24)
            .map(|index| format!("word{index}"))
            .collect::<Vec<_>>()
            .join(" ");
        let summary = analyze_text_overview(&format!("{text}."))
            .expect("analysis should succeed");

        assert_eq!(
            summary.highlights[1].detail,
            "The longest sentence runs to 24 words."
        );
    }
}
