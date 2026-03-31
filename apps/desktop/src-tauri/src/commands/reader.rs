use linguride_core::{reader, ReaderMode, ReaderResult};
use tauri::AppHandle;

use crate::adapters::capture_store::load_workspace;

#[tauri::command]
pub fn run_reader_capture(
    app: AppHandle,
    capture_id: String,
    mode: Option<ReaderMode>,
) -> Result<ReaderResult, String> {
    let snapshot = load_workspace(&app).map_err(|error| error.message)?;
    let capture = snapshot
        .captures
        .iter()
        .find(|item| item.id == capture_id)
        .ok_or_else(|| "Capture not found.".to_owned())?;

    reader::run_reader_mode(capture, mode.unwrap_or_default()).map_err(|error| error.message)
}
