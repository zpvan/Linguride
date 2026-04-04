use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum OpenAiOAuthStatus {
    Missing,
    Pending,
    Connected,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiOAuthCredentials {
    pub access_token: String,
    pub refresh_token: String,
    pub account_id: String,
    pub expires_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiOAuthStart {
    pub authorize_url: String,
    pub state: String,
    pub code_verifier: String,
}
