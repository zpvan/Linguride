use linguride_domain::{CorpusAction, CorpusResult};

pub fn run_corpus_action(action: CorpusAction) -> CorpusResult {
    let segmented_sentences = action
        .input_text
        .split('.')
        .map(str::trim)
        .filter(|sentence| !sentence.is_empty())
        .map(ToOwned::to_owned)
        .collect();

    CorpusResult { segmented_sentences }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn segments_sentences_on_periods() {
        let result = run_corpus_action(CorpusAction {
            input_text: "First. Second. ".into(),
        });

        assert_eq!(result.segmented_sentences, vec!["First", "Second"]);
    }
}
