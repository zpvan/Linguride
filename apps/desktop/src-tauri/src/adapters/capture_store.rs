use std::fs;
use std::path::PathBuf;

use linguride_core::{LingurideError, LingurideErrorCode};
use tauri::{AppHandle, Manager};

use crate::state::WorkspaceSnapshot;

const WORKSPACE_FILE: &str = "workspace.json";

pub fn load_workspace(app: &AppHandle) -> Result<WorkspaceSnapshot, LingurideError> {
    let path = workspace_file_path(app)?;
    if !path.exists() {
        return Ok(WorkspaceSnapshot::default());
    }

    let contents = fs::read_to_string(&path).map_err(|error| {
        LingurideError::new(
            LingurideErrorCode::PersistenceFailure,
            format!("Failed to read workspace state: {error}"),
        )
    })?;

    serde_json::from_str::<WorkspaceSnapshot>(&contents).map_err(|error| {
        LingurideError::new(
            LingurideErrorCode::PersistenceFailure,
            format!("Failed to parse workspace state: {error}"),
        )
    })
}

pub fn save_workspace(
    app: &AppHandle,
    snapshot: &WorkspaceSnapshot,
) -> Result<(), LingurideError> {
    let path = workspace_file_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            LingurideError::new(
                LingurideErrorCode::PersistenceFailure,
                format!("Failed to create workspace directory: {error}"),
            )
        })?;
    }

    let contents = serde_json::to_string_pretty(snapshot).map_err(|error| {
        LingurideError::new(
            LingurideErrorCode::PersistenceFailure,
            format!("Failed to encode workspace state: {error}"),
        )
    })?;

    fs::write(path, contents).map_err(|error| {
        LingurideError::new(
            LingurideErrorCode::PersistenceFailure,
            format!("Failed to write workspace state: {error}"),
        )
    })
}

fn workspace_file_path(app: &AppHandle) -> Result<PathBuf, LingurideError> {
    let app_data_dir = app.path().app_data_dir().map_err(|error| {
        LingurideError::new(
            LingurideErrorCode::PersistenceFailure,
            format!("Failed to resolve app data directory: {error}"),
        )
    })?;

    Ok(app_data_dir.join(WORKSPACE_FILE))
}
