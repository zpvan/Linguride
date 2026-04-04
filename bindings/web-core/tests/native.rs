use linguride_core::{capture, ReaderMode};
use linguride_domain::{CaptureRecord as DomainCaptureRecord, ReaderResult};
use web_core::{analyze_capture_record, analyze_capture_text, ingest_handoff};

#[test]
fn analyze_capture_text_returns_reader_result_json() {
    let json = analyze_capture_text("Linguride keeps bindings honest.", Some("Sample".into()))
        .expect("analysis should succeed");
    let result: ReaderResult = serde_json::from_str(&json).expect("result should decode");

    assert_eq!(result.document.title, "Sample");
    assert_eq!(result.document.mode, ReaderMode::Translate);
    assert!(result.summary.metrics.word_count > 0);
}

#[test]
fn ingest_handoff_accepts_json_payload() {
    let envelope = capture::create_handoff_envelope(
        "Payload for handoff.",
        Some("Handoff".into()),
        Some("https://example.com".into()),
        linguride_core::PreferredSurface::Reader,
        ReaderMode::Translate,
    )
    .expect("handoff should build");

    let json = ingest_handoff(&serde_json::to_string(&envelope).expect("payload should serialize"))
        .expect("handoff should ingest");
    let record: DomainCaptureRecord = serde_json::from_str(&json).expect("record should decode");

    assert_eq!(record.title, "Handoff");
    assert_eq!(record.origin_url.as_deref(), Some("https://example.com"));
}

#[test]
fn analyze_capture_record_runs_reader_mode() {
    let capture = capture::create_manual_capture(
        "Reader record input.",
        Some("Record".into()),
        None,
        ReaderMode::Translate,
    )
    .expect("capture should succeed");

    let result = analyze_capture_record(&capture).expect("analysis should succeed");

    assert_eq!(result.document.capture_id, capture.id);
    assert_eq!(result.document.title, "Record");
}
