use std::fs;
#[cfg(test)]
use std::path::Path;
use std::path::PathBuf;

use linguride_core::ports::capture_store::CaptureStorePort;
use linguride_core::ports::config_store::ConfigStorePort;
use linguride_core::ports::session_store::SessionStorePort;
use linguride_core::{
    CaptureRecord, LingurideConfig, LingurideError, LingurideErrorCode, SessionRecord,
    WorkspaceSnapshot,
};
use tauri::{AppHandle, Manager};

const WORKSPACE_FILE: &str = "workspace.json";

#[derive(Debug, Clone)]
pub struct JsonWorkspaceStore {
    workspace_path: PathBuf,
}

impl JsonWorkspaceStore {
    pub fn new(root_dir: impl Into<PathBuf>) -> Self {
        Self {
            workspace_path: root_dir.into().join(WORKSPACE_FILE),
        }
    }

    pub fn from_app(app: &AppHandle) -> Result<Self, LingurideError> {
        let app_data_dir = app.path().app_data_dir().map_err(|error| {
            LingurideError::new(
                LingurideErrorCode::PersistenceFailure,
                format!("Failed to resolve app data directory: {error}"),
            )
        })?;

        Ok(Self::new(app_data_dir))
    }

    #[cfg(test)]
    pub fn workspace_path(&self) -> &Path {
        &self.workspace_path
    }

    pub fn load_snapshot(&self) -> Result<WorkspaceSnapshot, LingurideError> {
        if !self.workspace_path.exists() {
            return Ok(WorkspaceSnapshot::default());
        }

        let contents = fs::read_to_string(&self.workspace_path).map_err(|error| {
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

    pub fn save_snapshot(&self, snapshot: &WorkspaceSnapshot) -> Result<(), LingurideError> {
        if let Some(parent) = self.workspace_path.parent() {
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

        fs::write(&self.workspace_path, contents).map_err(|error| {
            LingurideError::new(
                LingurideErrorCode::PersistenceFailure,
                format!("Failed to write workspace state: {error}"),
            )
        })
    }
}

impl CaptureStorePort for JsonWorkspaceStore {
    fn list_captures(&self) -> Result<Vec<CaptureRecord>, LingurideError> {
        Ok(self.load_snapshot()?.captures)
    }

    fn save_capture(&self, capture: &CaptureRecord) -> Result<(), LingurideError> {
        let mut snapshot = self.load_snapshot()?;
        snapshot.captures.retain(|item| item.id != capture.id);
        snapshot.captures.insert(0, capture.clone());
        self.save_snapshot(&snapshot)
    }
}

impl SessionStorePort for JsonWorkspaceStore {
    fn list_sessions(&self) -> Result<Vec<SessionRecord>, LingurideError> {
        Ok(self.load_snapshot()?.sessions)
    }

    fn save_session(&self, session: &SessionRecord) -> Result<(), LingurideError> {
        let mut snapshot = self.load_snapshot()?;
        snapshot.sessions.retain(|item| item.id != session.id);
        snapshot.sessions.insert(0, session.clone());
        self.save_snapshot(&snapshot)
    }
}

impl ConfigStorePort for JsonWorkspaceStore {
    fn load_config(&self) -> Result<LingurideConfig, LingurideError> {
        Ok(self.load_snapshot()?.config)
    }

    fn save_config(&self, config: &LingurideConfig) -> Result<(), LingurideError> {
        let mut snapshot = self.load_snapshot()?;
        snapshot.config = config.clone();
        self.save_snapshot(&snapshot)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn returns_default_snapshot_when_workspace_file_is_missing() {
        let tempdir = tempdir().expect("tempdir should exist");
        let store = JsonWorkspaceStore::new(tempdir.path());

        assert_eq!(
            store.load_snapshot().expect("snapshot should load"),
            WorkspaceSnapshot::default()
        );
        assert!(!store.workspace_path().exists());
    }

    #[test]
    fn saves_and_loads_workspace_snapshot_roundtrip() {
        let tempdir = tempdir().expect("tempdir should exist");
        let store = JsonWorkspaceStore::new(tempdir.path());
        let snapshot = WorkspaceSnapshot {
            config: LingurideConfig::default(),
            captures: vec![CaptureRecord {
                id: "capture-1".into(),
                source_app: linguride_core::CaptureSourceApp::ManualInput,
                capture_type: linguride_core::CaptureType::Manual,
                preferred_surface: linguride_core::PreferredSurface::Reader,
                origin_url: None,
                title: "Article".into(),
                text: "Text".into(),
                preview: "Text".into(),
                content_hash: "hash".into(),
                created_at: 1,
                truncated: false,
            }],
            sessions: Vec::new(),
        };

        store
            .save_snapshot(&snapshot)
            .expect("snapshot should save");

        assert!(store.workspace_path().exists());
        assert_eq!(
            store.load_snapshot().expect("snapshot should load"),
            snapshot
        );
    }

    #[test]
    fn returns_persistence_failure_for_invalid_json() {
        let tempdir = tempdir().expect("tempdir should exist");
        let store = JsonWorkspaceStore::new(tempdir.path());

        fs::write(store.workspace_path(), "{invalid json").expect("fixture should write");

        let error = store
            .load_snapshot()
            .expect_err("invalid json should fail");

        assert_eq!(error.code, LingurideErrorCode::PersistenceFailure);
    }
}
