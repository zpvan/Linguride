use linguride_core::{capture, reader, CaptureRecord, ReaderMode};
use linguride_domain::{CaptureEnvelope, ReaderResult};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub fn core_version() -> String {
    format!("linguride-web-core/{}", env!("CARGO_PKG_VERSION"))
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub fn analyze_capture_text(text: &str, title: Option<String>) -> Result<String, String> {
    let capture = capture::create_manual_capture(text, title, None, ReaderMode::Translate)
        .map_err(|error| error.message)?;
    let result = reader::run_reader_mode(&capture, ReaderMode::Translate)
        .map_err(|error| error.message)?;

    serde_json::to_string(&result).map_err(|error| error.to_string())
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub fn ingest_handoff(json_payload: &str) -> Result<String, String> {
    let envelope =
        serde_json::from_str::<CaptureEnvelope>(json_payload).map_err(|error| error.to_string())?;
    let record =
        capture::ingest_capture_envelope(&envelope, linguride_core::support::now_millis())
            .map_err(|error| error.message)?;

    serde_json::to_string(&record).map_err(|error| error.to_string())
}

pub fn analyze_capture_record(capture_record: &CaptureRecord) -> Result<ReaderResult, String> {
    reader::run_reader_mode(capture_record, ReaderMode::Translate).map_err(|error| error.message)
}
