pub mod capture;
pub mod config;
pub mod corpus;
pub mod errors;
pub mod oauth;
pub mod reader;
pub mod session;
pub mod tutor;

pub use capture::{
    CaptureEnvelope, CaptureRecord, CaptureSourceApp, CaptureType, PreferredSurface,
};
pub use config::{CefrLevel, LingurideConfig, OpenAiAuthMode, ProviderKind};
pub use corpus::{CorpusAction, CorpusResult};
pub use errors::{LingurideError, LingurideErrorCode};
pub use oauth::{OpenAiOAuthCredentials, OpenAiOAuthStart, OpenAiOAuthStatus};
pub use reader::{
    DifficultyReport, DifficultyTier, ReaderBlock, ReaderDocument, ReaderMode, ReaderResult,
    TextAnalysisHighlight, TextAnalysisMetrics, TextAnalysisSummary,
};
pub use session::{SessionKind, SessionRecord, SessionStatus};
pub use tutor::{TutorAction, TutorResult};
