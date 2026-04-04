use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LingurideErrorCode {
    EmptyText,
    InvalidCaptureEnvelope,
    CaptureExpired,
    CaptureMismatch,
    NotFound,
    UnsupportedOperation,
    PersistenceFailure,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LingurideError {
    pub code: LingurideErrorCode,
    pub message: String,
}

impl LingurideError {
    pub fn new(code: LingurideErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}
