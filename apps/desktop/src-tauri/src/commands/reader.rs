use linguride_core::{ReaderMode, ReaderResult};
use tauri::AppHandle;

use crate::commands::workspace_service;

#[tauri::command]
pub fn run_reader_capture(
    app: AppHandle,
    capture_id: String,
    mode: Option<ReaderMode>,
) -> Result<ReaderResult, String> {
    workspace_service(&app)
        .map_err(|error| error.message)?
        .run_reader_capture(&capture_id, mode)
        .map_err(|error| error.message)
}
