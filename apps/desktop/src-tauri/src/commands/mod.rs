mod handoff;
mod reader;
mod settings;
mod workspace;

use linguride_core::support::{SystemClock, SystemIdGenerator};
use linguride_core::{LingurideError, WorkspaceService};
use tauri::AppHandle;

use crate::adapters::workspace_store::JsonWorkspaceStore;

pub use handoff::ingest_capture_envelope;
pub use reader::run_reader_capture;
pub use settings::save_workspace_config;
pub use workspace::{ingest_manual_capture, load_workspace_snapshot};

type DesktopWorkspaceService = WorkspaceService<
    JsonWorkspaceStore,
    JsonWorkspaceStore,
    JsonWorkspaceStore,
    SystemClock,
    SystemIdGenerator,
>;

pub(crate) fn workspace_service(app: &AppHandle) -> Result<DesktopWorkspaceService, LingurideError> {
    let store = JsonWorkspaceStore::from_app(app)?;
    Ok(WorkspaceService::new(
        store.clone(),
        store.clone(),
        store,
        SystemClock,
        SystemIdGenerator,
    ))
}
