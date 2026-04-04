use linguride_domain::{
    CaptureEnvelope, CaptureRecord, CaptureSourceApp, CaptureType, LingurideError,
    LingurideErrorCode, PreferredSurface, ReaderMode,
};

use crate::ports::clock::ClockPort;
use crate::ports::id_generator::IdGeneratorPort;
use crate::support::{make_hash, make_preview, SystemClock, SystemIdGenerator};
use crate::MAX_CAPTURE_CHARS;

const HANDOFF_TTL_MS: u64 = 2 * 60 * 1000;

pub fn create_manual_capture(
    text: &str,
    title: Option<String>,
    origin_url: Option<String>,
    reader_mode: ReaderMode,
) -> Result<CaptureRecord, LingurideError> {
    create_manual_capture_with_ports(
        text,
        title,
        origin_url,
        reader_mode,
        &SystemClock,
        &SystemIdGenerator,
    )
}

pub fn create_manual_capture_with_ports<Clock, IdGenerator>(
    text: &str,
    title: Option<String>,
    origin_url: Option<String>,
    reader_mode: ReaderMode,
    clock: &Clock,
    id_generator: &IdGenerator,
) -> Result<CaptureRecord, LingurideError>
where
    Clock: ClockPort,
    IdGenerator: IdGeneratorPort,
{
    let normalized_text = text.trim();
    if normalized_text.is_empty() {
        return Err(LingurideError::new(
            LingurideErrorCode::EmptyText,
            "Capture text requires at least one non-empty line.",
        ));
    }

    let created_at = clock.now_millis();
    let truncated_text = truncate_text(normalized_text);
    let content_hash = make_hash(&truncated_text.0);
    let capture_id = id_generator.next_id(match reader_mode {
        ReaderMode::Translate => "capture-translate",
        ReaderMode::Paraphrase => "capture-paraphrase",
        ReaderMode::Mixed => "capture-mixed",
    });

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
    create_handoff_envelope_with_ports(
        text,
        title,
        origin_url,
        preferred_surface,
        reader_mode,
        &SystemClock,
        &SystemIdGenerator,
    )
}

pub fn create_handoff_envelope_with_ports<Clock, IdGenerator>(
    text: &str,
    title: Option<String>,
    origin_url: Option<String>,
    preferred_surface: PreferredSurface,
    reader_mode: ReaderMode,
    clock: &Clock,
    id_generator: &IdGenerator,
) -> Result<CaptureEnvelope, LingurideError>
where
    Clock: ClockPort,
    IdGenerator: IdGeneratorPort,
{
    let capture = create_manual_capture_with_ports(
        text,
        title,
        origin_url,
        reader_mode,
        clock,
        id_generator,
    )?;

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

#[cfg(test)]
mod tests {
    use super::*;

    struct FixedClock(u64);

    impl ClockPort for FixedClock {
        fn now_millis(&self) -> u64 {
            self.0
        }
    }

    struct FixedIdGenerator(&'static str);

    impl IdGeneratorPort for FixedIdGenerator {
        fn next_id(&self, namespace: &str) -> String {
            format!("{namespace}-{}", self.0)
        }
    }

    #[test]
    fn creates_manual_capture_with_defaults_and_preview() {
        let capture = create_manual_capture_with_ports(
            "  Linguride keeps tests predictable.  ",
            None,
            Some("https://example.com".into()),
            ReaderMode::Translate,
            &FixedClock(42),
            &FixedIdGenerator("id-1"),
        )
        .expect("capture should succeed");

        assert_eq!(capture.id, "capture-translate-id-1");
        assert_eq!(capture.title, "Manual Capture");
        assert_eq!(capture.created_at, 42);
        assert_eq!(capture.preview, "Linguride keeps tests predictable.");
        assert_eq!(capture.origin_url.as_deref(), Some("https://example.com"));
        assert!(!capture.truncated);
    }

    #[test]
    fn truncates_manual_capture_text_at_max_chars() {
        let text = "a".repeat(MAX_CAPTURE_CHARS + 5);
        let capture = create_manual_capture_with_ports(
            &text,
            Some("Large".into()),
            None,
            ReaderMode::Mixed,
            &FixedClock(7),
            &FixedIdGenerator("id-2"),
        )
        .expect("capture should succeed");

        assert_eq!(capture.text.len(), MAX_CAPTURE_CHARS);
        assert!(capture.truncated);
        assert_eq!(capture.preview, format!("{}...", "a".repeat(120)));
    }

    #[test]
    fn rejects_empty_manual_capture() {
        let error = create_manual_capture_with_ports(
            " \n ",
            None,
            None,
            ReaderMode::Translate,
            &FixedClock(1),
            &FixedIdGenerator("id-3"),
        )
        .expect_err("empty text should fail");

        assert_eq!(error.code, LingurideErrorCode::EmptyText);
    }

    #[test]
    fn creates_handoff_envelope_with_expected_ttl() {
        let envelope = create_handoff_envelope_with_ports(
            "Sentence one.",
            Some("Article".into()),
            None,
            PreferredSurface::Tutor,
            ReaderMode::Paraphrase,
            &FixedClock(500),
            &FixedIdGenerator("id-4"),
        )
        .expect("handoff should succeed");

        assert_eq!(envelope.handoff_id, "capture-paraphrase-id-4");
        assert_eq!(envelope.preferred_surface, PreferredSurface::Tutor);
        assert_eq!(envelope.reader_mode, Some(ReaderMode::Paraphrase));
        assert_eq!(envelope.created_at, 500);
        assert_eq!(envelope.expires_at, 500 + HANDOFF_TTL_MS);
    }

    #[test]
    fn rejects_handoff_envelope_with_missing_fields() {
        let envelope = CaptureEnvelope {
            schema_version: 1,
            handoff_id: " ".into(),
            source_app: CaptureSourceApp::BrowserExtension,
            capture_type: CaptureType::Page,
            preferred_surface: PreferredSurface::Reader,
            origin_url: None,
            title: Some("Sample".into()),
            text: "Text".into(),
            reader_mode: Some(ReaderMode::Translate),
            user_level: None,
            content_hash: make_hash("Text"),
            created_at: 10,
            expires_at: 20,
            truncated: false,
        };

        let error = ingest_capture_envelope(&envelope, 15).expect_err("envelope should fail");
        assert_eq!(error.code, LingurideErrorCode::InvalidCaptureEnvelope);
    }

    #[test]
    fn rejects_expired_handoff_envelope() {
        let envelope = CaptureEnvelope {
            schema_version: 1,
            handoff_id: "capture-1".into(),
            source_app: CaptureSourceApp::BrowserExtension,
            capture_type: CaptureType::Page,
            preferred_surface: PreferredSurface::Reader,
            origin_url: None,
            title: Some("Sample".into()),
            text: "Text".into(),
            reader_mode: Some(ReaderMode::Translate),
            user_level: None,
            content_hash: make_hash("Text"),
            created_at: 10,
            expires_at: 20,
            truncated: false,
        };

        let error = ingest_capture_envelope(&envelope, 21).expect_err("envelope should expire");
        assert_eq!(error.code, LingurideErrorCode::CaptureExpired);
    }

    #[test]
    fn rejects_handoff_envelope_with_hash_mismatch() {
        let envelope = CaptureEnvelope {
            schema_version: 1,
            handoff_id: "capture-1".into(),
            source_app: CaptureSourceApp::BrowserExtension,
            capture_type: CaptureType::Page,
            preferred_surface: PreferredSurface::Reader,
            origin_url: None,
            title: Some("Sample".into()),
            text: "Text".into(),
            reader_mode: Some(ReaderMode::Translate),
            user_level: None,
            content_hash: "unexpected".into(),
            created_at: 10,
            expires_at: 20,
            truncated: false,
        };

        let error = ingest_capture_envelope(&envelope, 20).expect_err("hash should fail");
        assert_eq!(error.code, LingurideErrorCode::CaptureMismatch);
    }

    #[test]
    fn ingests_handoff_envelope_with_fallback_title_and_truncated_merge() {
        let oversized = format!("{}{}", "a".repeat(MAX_CAPTURE_CHARS), "tail");
        let envelope = CaptureEnvelope {
            schema_version: 1,
            handoff_id: "capture-1".into(),
            source_app: CaptureSourceApp::BrowserExtension,
            capture_type: CaptureType::Page,
            preferred_surface: PreferredSurface::Inbox,
            origin_url: None,
            title: None,
            text: oversized.clone(),
            reader_mode: Some(ReaderMode::Translate),
            user_level: None,
            content_hash: make_hash(&oversized.chars().take(MAX_CAPTURE_CHARS).collect::<String>()),
            created_at: 10,
            expires_at: 20,
            truncated: false,
        };

        let record = ingest_capture_envelope(&envelope, 20).expect("envelope should ingest");

        assert_eq!(record.title, "Linguride Handoff");
        assert_eq!(record.text.len(), MAX_CAPTURE_CHARS);
        assert!(record.truncated);
    }
}
