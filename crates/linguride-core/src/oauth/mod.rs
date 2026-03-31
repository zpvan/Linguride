use linguride_domain::{LingurideError, LingurideErrorCode, OpenAiOAuthStart};

use crate::support::{make_hash, now_millis};

pub fn start_openai_oauth() -> Result<OpenAiOAuthStart, LingurideError> {
    let started_at = now_millis();
    let state = format!("state-{}", started_at);
    let code_verifier = format!("verifier-{}", make_hash(&state));
    let authorize_url = format!(
        "https://auth.openai.com/oauth/authorize?state={}&code_challenge={}",
        state,
        make_hash(&code_verifier)
    );

    if authorize_url.is_empty() {
        return Err(LingurideError::new(
            LingurideErrorCode::UnsupportedOperation,
            "Unable to construct OAuth authorize URL.",
        ));
    }

    Ok(OpenAiOAuthStart {
        authorize_url,
        state,
        code_verifier,
    })
}
