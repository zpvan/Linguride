use linguride_core::LingurideConfig;
use tauri::AppHandle;

use crate::commands::workspace_service;

#[tauri::command]
pub fn save_workspace_config(
    app: AppHandle,
    next_config: LingurideConfig,
) -> Result<LingurideConfig, String> {
    workspace_service(&app)
        .map_err(|error| error.message)?
        .save_workspace_config(next_config)
        .map_err(|error| error.message)
}
