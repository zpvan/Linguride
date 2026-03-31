use std::collections::HashSet;
use std::fmt::{Display, Formatter};

pub use linguride_domain::{TextAnalysisHighlight, TextAnalysisMetrics, TextAnalysisSummary};

const WORDS_PER_MINUTE: f32 = 200.0;
const EXCERPT_LIMIT: usize = 180;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CoreError {
    EmptyText,
}

impl Display for CoreError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EmptyText => write!(f, "Text analysis requires at least one non-empty line."),
        }
    }
}

impl std::error::Error for CoreError {}

pub fn analyze_text_overview(text: &str) -> Result<TextAnalysisSummary, CoreError> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err(CoreError::EmptyText);
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

    let highlights = build_highlights(&words, &sentences, &metrics);

    Ok(TextAnalysisSummary {
        excerpt: build_excerpt(trimmed),
        normalized_text,
        metrics,
        highlights,
    })
}

fn normalize_text(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
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
    words: &[String],
    sentences: &[String],
    metrics: &TextAnalysisMetrics,
) -> Vec<TextAnalysisHighlight> {
    let longest_sentence = sentences
        .iter()
        .map(|sentence| split_words(sentence).len())
        .max()
        .unwrap_or(0);
    let long_word_count = words
        .iter()
        .filter(|word| word.chars().count() >= 7)
        .count();
    let unique_word_ratio = if words.is_empty() {
        0.0
    } else {
        let unique_words = words.iter().collect::<HashSet<_>>();
        unique_words.len() as f32 / words.len() as f32
    };

    vec![
        TextAnalysisHighlight {
            title: "Reading load".into(),
            detail: format!(
                "{} words across {} sentences, roughly {} minute(s) to read end-to-end.",
                metrics.word_count, metrics.sentence_count, metrics.estimated_reading_minutes
            ),
        },
        TextAnalysisHighlight {
            title: "Sentence rhythm".into(),
            detail: if longest_sentence >= 24 {
                format!(
                    "The longest sentence runs to {} words, so the desktop app should expect denser reading bursts.",
                    longest_sentence
                )
            } else {
                format!(
                    "Average sentence length is {} words, which keeps the cadence fairly approachable.",
                    metrics.average_sentence_length
                )
            },
        },
        TextAnalysisHighlight {
            title: "Vocabulary surface".into(),
            detail: if unique_word_ratio >= 0.6 || long_word_count >= 8 {
                format!(
                    "{} longer words and a {:.0}% unique-word ratio suggest broader vocabulary coverage.",
                    long_word_count,
                    round_to(unique_word_ratio * 100.0, 0)
                )
            } else {
                format!(
                    "{} longer words and a {:.0}% unique-word ratio point to a more repetitive vocabulary profile.",
                    long_word_count,
                    round_to(unique_word_ratio * 100.0, 0)
                )
            },
        },
    ]
}

fn build_excerpt(text: &str) -> String {
    let mut excerpt = String::new();
    for character in text.chars().take(EXCERPT_LIMIT) {
        excerpt.push(character);
    }

    if text.chars().count() > EXCERPT_LIMIT {
        excerpt.push_str("...");
    }

    excerpt
}

fn round_to(value: f32, decimals: u32) -> f32 {
    let factor = 10_f32.powi(decimals as i32);
    (value * factor).round() / factor
}

#[cfg(test)]
mod tests {
    use super::{analyze_text_overview, CoreError};

    #[test]
    fn rejects_empty_text() {
        let result = analyze_text_overview("   \n\n  ");

        assert_eq!(result.unwrap_err(), CoreError::EmptyText);
    }

    #[test]
    fn computes_metrics_and_highlights() {
        let sample = "Rust-powered desktop apps can reuse a shared analysis core. The result stays fast and predictable.";
        let result = analyze_text_overview(sample).expect("analysis should succeed");

        assert_eq!(result.metrics.word_count, 15);
        assert_eq!(result.metrics.sentence_count, 2);
        assert_eq!(result.highlights.len(), 3);
        assert!(result.normalized_text.contains("shared analysis core"));
        assert_eq!(result.excerpt, sample);
    }

    #[test]
    fn normalizes_whitespace_and_detects_paragraphs() {
        let sample = "First line with extra space.\n\nSecond paragraph keeps going.";
        let result = analyze_text_overview(sample).expect("analysis should succeed");

        assert_eq!(result.metrics.paragraph_count, 2);
        assert_eq!(
            result.normalized_text,
            "First line with extra space. Second paragraph keeps going."
        );
    }
}
