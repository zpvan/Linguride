use linguride_core::{LingurideError, LingurideErrorCode};

#[allow(dead_code)]
pub fn save_secret(_namespace: &str, _key: &str, _value: &str) -> Result<(), LingurideError> {
    Err(LingurideError::new(
        LingurideErrorCode::UnsupportedOperation,
        "Desktop credential storage is not wired yet.",
    ))
}
