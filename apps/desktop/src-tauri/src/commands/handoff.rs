use linguride_core::{CaptureEnvelope, CaptureRecord};
use tauri::AppHandle;

use crate::commands::workspace_service;

#[tauri::command]
pub fn ingest_capture_envelope(
    app: AppHandle,
    envelope: CaptureEnvelope,
) -> Result<CaptureRecord, String> {
    workspace_service(&app)
        .map_err(|error| error.message)?
        .ingest_capture_envelope(&envelope)
        .map_err(|error| error.message)
}
