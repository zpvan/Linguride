use linguride_domain::{
    CaptureEnvelope, CaptureRecord, CaptureSourceApp, CaptureType, LingurideError,
    LingurideErrorCode, PreferredSurface, ReaderMode,
};

use crate::support::{make_hash, make_preview, now_millis};
use crate::MAX_CAPTURE_CHARS;

const HANDOFF_TTL_MS: u64 = 2 * 60 * 1000;

pub fn create_manual_capture(
    text: &str,
    title: Option<String>,
    origin_url: Option<String>,
    _reader_mode: ReaderMode,
) -> Result<CaptureRecord, LingurideError> {
    let normalized_text = text.trim();
    if normalized_text.is_empty() {
        return Err(LingurideError::new(
            LingurideErrorCode::EmptyText,
            "Capture text requires at least one non-empty line.",
        ));
    }

    let created_at = now_millis();
    let truncated_text = truncate_text(normalized_text);
    let content_hash = make_hash(&truncated_text.0);
    let capture_id = format!("capture-{}-{}", created_at, &content_hash[..8]);

    Ok(CaptureRecord {
        id: capture_id,
        source_app: CaptureSourceApp::ManualInput,
        capture_type: CaptureType::Manual,
        preferred_surface: PreferredSurface::Reader,
        origin_url,
        title: title.unwrap_or_else(|| "Manual Capture".into()),
        preview: make_preview(&truncated_text.0, 120),
        text: truncated_text.0,
        content_hash,
        created_at,
        truncated: truncated_text.1,
    })
}

pub fn create_handoff_envelope(
    text: &str,
    title: Option<String>,
    origin_url: Option<String>,
    preferred_surface: PreferredSurface,
    reader_mode: ReaderMode,
) -> Result<CaptureEnvelope, LingurideError> {
    let capture = create_manual_capture(text, title, origin_url, reader_mode)?;

    Ok(CaptureEnvelope {
        schema_version: 1,
        handoff_id: capture.id.clone(),
        source_app: CaptureSourceApp::BrowserExtension,
        capture_type: CaptureType::Page,
        preferred_surface,
        origin_url: capture.origin_url.clone(),
        title: Some(capture.title.clone()),
        text: capture.text.clone(),
        reader_mode: Some(reader_mode),
        user_level: None,
        content_hash: capture.content_hash.clone(),
        created_at: capture.created_at,
        expires_at: capture.created_at + HANDOFF_TTL_MS,
        truncated: capture.truncated,
    })
}

pub fn ingest_capture_envelope(
    envelope: &CaptureEnvelope,
    now_ms: u64,
) -> Result<CaptureRecord, LingurideError> {
    if envelope.handoff_id.trim().is_empty() || envelope.text.trim().is_empty() {
        return Err(LingurideError::new(
            LingurideErrorCode::InvalidCaptureEnvelope,
            "Handoff envelope is missing required fields.",
        ));
    }

    if now_ms > envelope.expires_at {
        return Err(LingurideError::new(
            LingurideErrorCode::CaptureExpired,
            "The handoff envelope has expired.",
        ));
    }

    let truncated_text = truncate_text(envelope.text.trim());
    let expected_hash = make_hash(&truncated_text.0);
    if expected_hash != envelope.content_hash {
        return Err(LingurideError::new(
            LingurideErrorCode::CaptureMismatch,
            "The handoff envelope content hash does not match its payload.",
        ));
    }

    Ok(CaptureRecord {
        id: envelope.handoff_id.clone(),
        source_app: envelope.source_app,
        capture_type: envelope.capture_type,
        preferred_surface: envelope.preferred_surface,
        origin_url: envelope.origin_url.clone(),
        title: envelope
            .title
            .clone()
            .unwrap_or_else(|| "Linguride Handoff".into()),
        preview: make_preview(&truncated_text.0, 120),
        text: truncated_text.0,
        content_hash: expected_hash,
        created_at: envelope.created_at,
        truncated: truncated_text.1 || envelope.truncated,
    })
}

fn truncate_text(text: &str) -> (String, bool) {
    let collected = text.chars().take(MAX_CAPTURE_CHARS).collect::<String>();
    let truncated = text.chars().count() > MAX_CAPTURE_CHARS;
    (collected, truncated)
}
