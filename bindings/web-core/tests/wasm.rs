#![cfg(target_arch = "wasm32")]

use linguride_core::{capture, PreferredSurface, ReaderMode};
use linguride_domain::{CaptureRecord, ReaderResult};
use wasm_bindgen_test::wasm_bindgen_test;

#[wasm_bindgen_test]
fn core_version_has_expected_prefix() {
    assert!(web_core::core_version().starts_with("linguride-web-core/"));
}

#[wasm_bindgen_test]
fn analyze_capture_text_roundtrips_in_wasm() {
    let json = web_core::analyze_capture_text("WASM keeps bindings aligned.", Some("Wasm".into()))
        .expect("analysis should succeed");
    let result: ReaderResult = serde_json::from_str(&json).expect("result should decode");

    assert_eq!(result.document.title, "Wasm");
    assert!(result.summary.metrics.word_count > 0);
}

#[wasm_bindgen_test]
fn ingest_handoff_roundtrips_in_wasm() {
    let envelope = capture::create_handoff_envelope(
        "Payload for wasm handoff.",
        Some("Wasm Handoff".into()),
        None,
        PreferredSurface::Reader,
        ReaderMode::Translate,
    )
    .expect("handoff should build");

    let json = web_core::ingest_handoff(&serde_json::to_string(&envelope).expect("payload should encode"))
        .expect("handoff should ingest");
    let record: CaptureRecord = serde_json::from_str(&json).expect("record should decode");

    assert_eq!(record.title, "Wasm Handoff");
}
