use linguride_core::{capture, CaptureRecord, ReaderMode};
use tauri::AppHandle;

use crate::adapters::capture_store::{load_workspace, save_workspace};
use crate::state::{ManualCaptureInput, WorkspaceSnapshot};

#[tauri::command]
pub fn load_workspace_snapshot(app: AppHandle) -> Result<WorkspaceSnapshot, String> {
    load_workspace(&app).map_err(|error| error.message)
}

#[tauri::command]
pub fn ingest_manual_capture(
    app: AppHandle,
    input: ManualCaptureInput,
) -> Result<CaptureRecord, String> {
    let capture = capture::create_manual_capture(
        &input.text,
        input.title,
        input.origin_url,
        ReaderMode::Translate,
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
