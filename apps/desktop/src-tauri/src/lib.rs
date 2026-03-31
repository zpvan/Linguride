#[tauri::command]
fn analyze_text_overview(text: &str) -> Result<linguride_core::TextAnalysisSummary, String> {
    linguride_core::analyze_text_overview(text).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![analyze_text_overview])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
