use serde::{Deserialize, Serialize};

use crate::config::CefrLevel;
use crate::reader::ReaderMode;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CaptureSourceApp {
    BrowserExtension,
    DesktopApp,
    ManualInput,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CaptureType {
    Page,
    Selection,
    Clipboard,
    Manual,
    FileImport,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PreferredSurface {
    Inbox,
    Reader,
    Tutor,
    Corpus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CaptureEnvelope {
    pub schema_version: u16,
    pub handoff_id: String,
    pub source_app: CaptureSourceApp,
    pub capture_type: CaptureType,
    pub preferred_surface: PreferredSurface,
    pub origin_url: Option<String>,
    pub title: Option<String>,
    pub text: String,
    pub reader_mode: Option<ReaderMode>,
    pub user_level: Option<CefrLevel>,
    pub content_hash: String,
    pub created_at: u64,
    pub expires_at: u64,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CaptureRecord {
    pub id: String,
    pub source_app: CaptureSourceApp,
    pub capture_type: CaptureType,
    pub preferred_surface: PreferredSurface,
    pub origin_url: Option<String>,
    pub title: String,
    pub text: String,
    pub preview: String,
    pub content_hash: String,
    pub created_at: u64,
    pub truncated: bool,
}
