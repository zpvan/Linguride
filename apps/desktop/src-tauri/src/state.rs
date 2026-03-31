use serde::{Deserialize, Serialize};

use linguride_core::{CaptureRecord, LingurideConfig, SessionRecord};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshot {
    pub config: LingurideConfig,
    pub captures: Vec<CaptureRecord>,
    pub sessions: Vec<SessionRecord>,
}

impl Default for WorkspaceSnapshot {
    fn default() -> Self {
        Self {
            config: LingurideConfig::default(),
            captures: Vec::new(),
            sessions: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualCaptureInput {
    pub text: String,
    pub title: Option<String>,
    pub origin_url: Option<String>,
}
