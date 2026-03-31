use linguride_core::{config, LingurideConfig};
use tauri::AppHandle;

use crate::adapters::capture_store::{load_workspace, save_workspace};

#[tauri::command]
pub fn save_workspace_config(
    app: AppHandle,
    next_config: LingurideConfig,
) -> Result<LingurideConfig, String> {
    let mut snapshot = load_workspace(&app).map_err(|error| error.message)?;
    snapshot.config = config::normalize_config(next_config);
    save_workspace(&app, &snapshot).map_err(|error| error.message)?;
    Ok(snapshot.config)
}
