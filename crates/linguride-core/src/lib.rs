pub mod capture;
pub mod config;
pub mod corpus;
pub mod oauth;
pub mod ports;
pub mod provider;
pub mod reader;
pub mod session;
pub mod support;
pub mod tutor;
pub mod workspace;

pub use linguride_domain::{
    CaptureEnvelope, CaptureRecord, CaptureSourceApp, CaptureType, CefrLevel, CorpusAction,
    CorpusResult, DifficultyReport, DifficultyTier, LingurideConfig, LingurideError,
    LingurideErrorCode, OpenAiAuthMode, OpenAiOAuthCredentials, OpenAiOAuthStart,
    OpenAiOAuthStatus, PreferredSurface, ProviderKind, ReaderBlock, ReaderDocument, ReaderMode,
    ReaderResult, SessionKind, SessionRecord, SessionStatus, TextAnalysisHighlight,
    TextAnalysisMetrics, TextAnalysisSummary, TutorAction, TutorResult,
};
pub use workspace::{ManualCaptureInput, WorkspaceService, WorkspaceSnapshot};

pub const MAX_CAPTURE_CHARS: usize = 200_000;

#[cfg(test)]
mod tests {
    use super::{capture, reader, ReaderMode};

    #[test]
    fn builds_capture_and_reader_result() {
        let capture = capture::create_manual_capture(
            "Linguride keeps the browser and desktop aligned.",
            Some("Sample".into()),
            None,
            ReaderMode::Translate,
        )
        .expect("capture should succeed");

        let reader = reader::run_reader_mode(&capture, ReaderMode::Translate)
            .expect("reader mode should succeed");

        assert_eq!(reader.document.capture_id, capture.id);
        assert!(!reader.document.blocks.is_empty());
        assert!(reader.summary.metrics.word_count > 0);
    }
}
