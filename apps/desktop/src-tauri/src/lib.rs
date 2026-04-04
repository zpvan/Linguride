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

#[cfg(test)]
mod tests {
    use std::cell::Cell;

    use linguride_core::ports::clock::ClockPort;
    use linguride_core::ports::id_generator::IdGeneratorPort;
    use linguride_core::{
        CefrLevel, LingurideConfig, OpenAiAuthMode, ProviderKind, ReaderMode, WorkspaceService,
    };
    use tempfile::tempdir;

    use crate::adapters::workspace_store::JsonWorkspaceStore;
    use crate::state::ManualCaptureInput;

    struct FixedClock(u64);

    impl ClockPort for FixedClock {
        fn now_millis(&self) -> u64 {
            self.0
        }
    }

    #[derive(Default)]
    struct SequenceIdGenerator {
        next: Cell<u64>,
    }

    impl IdGeneratorPort for SequenceIdGenerator {
        fn next_id(&self, namespace: &str) -> String {
            let next = self.next.get();
            self.next.set(next + 1);
            format!("{namespace}-{next}")
        }
    }

    #[test]
    fn desktop_workspace_flow_persists_capture_reader_and_config() {
        let tempdir = tempdir().expect("tempdir should exist");
        let store = JsonWorkspaceStore::new(tempdir.path());
        let service = WorkspaceService::new(
            store.clone(),
            store.clone(),
            store.clone(),
            FixedClock(500),
            SequenceIdGenerator::default(),
        );

        let initial = service
            .load_workspace_snapshot()
            .expect("initial snapshot should load");
        assert_eq!(initial, linguride_core::WorkspaceSnapshot::default());

        let capture = service
            .ingest_manual_capture(ManualCaptureInput {
                text: "First paragraph.\n\nSecond paragraph.".into(),
                title: Some("Manual".into()),
                origin_url: Some("https://example.com".into()),
            })
            .expect("manual capture should ingest");
        let reader = service
            .run_reader_capture(&capture.id, Some(ReaderMode::Mixed))
            .expect("reader should run");
        let saved_config = service
            .save_workspace_config(LingurideConfig {
                provider: ProviderKind::OpenAi,
                openai_auth_mode: OpenAiAuthMode::OAuth,
                api_base_url: " ".into(),
                model: String::new(),
                user_level: CefrLevel::B2,
                reader_mode: ReaderMode::Paraphrase,
                desktop_handoff_enabled: false,
            })
            .expect("config should save");

        let reloaded = WorkspaceService::new(
            store.clone(),
            store.clone(),
            store.clone(),
            FixedClock(900),
            SequenceIdGenerator::default(),
        )
        .load_workspace_snapshot()
        .expect("reloaded snapshot should load");

        assert!(store.workspace_path().exists());
        assert_eq!(reader.document.capture_id, capture.id);
        assert_eq!(reader.document.blocks.len(), 2);
        assert_eq!(saved_config.api_base_url, "https://api.deepseek.com");
        assert_eq!(saved_config.model, "deepseek-chat");
        assert_eq!(reloaded.captures.len(), 1);
        assert_eq!(reloaded.sessions.len(), 1);
        assert_eq!(reloaded.sessions[0].capture_id.as_deref(), Some(capture.id.as_str()));
        assert_eq!(reloaded.config.provider, ProviderKind::OpenAi);
        assert_eq!(reloaded.config.openai_auth_mode, OpenAiAuthMode::OAuth);
        assert_eq!(reloaded.config.user_level, CefrLevel::B2);
        assert_eq!(reloaded.config.reader_mode, ReaderMode::Paraphrase);
        assert!(!reloaded.config.desktop_handoff_enabled);
    }
}
