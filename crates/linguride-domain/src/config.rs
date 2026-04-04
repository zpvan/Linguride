use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProviderKind {
    DeepSeek,
    OpenAi,
    Custom,
}

impl Default for ProviderKind {
    fn default() -> Self {
        Self::DeepSeek
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum OpenAiAuthMode {
    ApiKey,
    OAuth,
}

impl Default for OpenAiAuthMode {
    fn default() -> Self {
        Self::ApiKey
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum CefrLevel {
    A1,
    A2,
    B1,
    B2,
    C1,
    C2,
}

impl Default for CefrLevel {
    fn default() -> Self {
        Self::A2
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LingurideConfig {
    pub provider: ProviderKind,
    pub openai_auth_mode: OpenAiAuthMode,
    pub api_base_url: String,
    pub model: String,
    pub user_level: CefrLevel,
    pub reader_mode: super::reader::ReaderMode,
    pub desktop_handoff_enabled: bool,
}

impl Default for LingurideConfig {
    fn default() -> Self {
        Self {
            provider: ProviderKind::DeepSeek,
            openai_auth_mode: OpenAiAuthMode::ApiKey,
            api_base_url: "https://api.deepseek.com".into(),
            model: "deepseek-chat".into(),
            user_level: CefrLevel::A2,
            reader_mode: super::reader::ReaderMode::Translate,
            desktop_handoff_enabled: true,
        }
    }
}
