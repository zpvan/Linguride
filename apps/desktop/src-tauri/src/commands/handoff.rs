use linguride_core::{capture, CaptureRecord, CaptureEnvelope};
use tauri::AppHandle;

use crate::adapters::capture_store::{load_workspace, save_workspace};

#[tauri::command]
pub fn ingest_capture_envelope(
    app: AppHandle,
    envelope: CaptureEnvelope,
) -> Result<CaptureRecord, String> {
    let capture = capture::ingest_capture_envelope(
        &envelope,
        linguride_core::support::now_millis(),
    )
    .map_err(|error| error.message)?;

    let mut snapshot = load_workspace(&app).map_err(|error| error.message)?;
    snapshot.captures.insert(0, capture.clone());
    snapshot
        .sessions
        .insert(0, linguride_core::session::create_reader_session(&capture));
    save_workspace(&app, &snapshot).map_err(|error| error.message)?;

    Ok(capture)
}
