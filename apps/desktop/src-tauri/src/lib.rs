mod adapters;
mod commands;
mod state;

use commands::{
    ingest_capture_envelope, ingest_manual_capture, load_workspace_snapshot, run_reader_capture,
    save_workspace_config,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_workspace_snapshot,
            ingest_manual_capture,
            ingest_capture_envelope,
            run_reader_capture,
            save_workspace_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
