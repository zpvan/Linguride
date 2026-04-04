use linguride_core::CaptureRecord;
use tauri::AppHandle;

use crate::commands::workspace_service;
use crate::state::{ManualCaptureInput, WorkspaceSnapshot};

#[tauri::command]
pub fn load_workspace_snapshot(app: AppHandle) -> Result<WorkspaceSnapshot, String> {
    workspace_service(&app)
        .map_err(|error| error.message)?
        .load_workspace_snapshot()
        .map_err(|error| error.message)
}

#[tauri::command]
pub fn ingest_manual_capture(
    app: AppHandle,
    input: ManualCaptureInput,
) -> Result<CaptureRecord, String> {
    workspace_service(&app)
        .map_err(|error| error.message)?
        .ingest_manual_capture(input)
        .map_err(|error| error.message)
}
