use std::cell::{Cell, RefCell};
use std::rc::Rc;

use linguride_core::ports::capture_store::CaptureStorePort;
use linguride_core::ports::clock::ClockPort;
use linguride_core::ports::config_store::ConfigStorePort;
use linguride_core::ports::id_generator::IdGeneratorPort;
use linguride_core::ports::session_store::SessionStorePort;
use linguride_core::{
    CaptureEnvelope, CaptureRecord, CaptureSourceApp, CaptureType, LingurideConfig,
    LingurideError, LingurideErrorCode, PreferredSurface, ReaderMode, SessionRecord,
    WorkspaceService, WorkspaceSnapshot,
};

#[derive(Clone, Default)]
struct MemoryWorkspaceStore {
    snapshot: Rc<RefCell<WorkspaceSnapshot>>,
}

impl MemoryWorkspaceStore {
    fn with_snapshot(snapshot: WorkspaceSnapshot) -> Self {
        Self {
            snapshot: Rc::new(RefCell::new(snapshot)),
        }
    }
}

impl CaptureStorePort for MemoryWorkspaceStore {
    fn list_captures(&self) -> Result<Vec<CaptureRecord>, LingurideError> {
        Ok(self.snapshot.borrow().captures.clone())
    }

    fn save_capture(&self, capture: &CaptureRecord) -> Result<(), LingurideError> {
        let mut snapshot = self.snapshot.borrow_mut();
        snapshot.captures.retain(|item| item.id != capture.id);
        snapshot.captures.insert(0, capture.clone());
        Ok(())
    }
}

impl SessionStorePort for MemoryWorkspaceStore {
    fn list_sessions(&self) -> Result<Vec<SessionRecord>, LingurideError> {
        Ok(self.snapshot.borrow().sessions.clone())
    }

    fn save_session(&self, session: &SessionRecord) -> Result<(), LingurideError> {
        let mut snapshot = self.snapshot.borrow_mut();
        snapshot.sessions.retain(|item| item.id != session.id);
        snapshot.sessions.insert(0, session.clone());
        Ok(())
    }
}

impl ConfigStorePort for MemoryWorkspaceStore {
    fn load_config(&self) -> Result<LingurideConfig, LingurideError> {
        Ok(self.snapshot.borrow().config.clone())
    }

    fn save_config(&self, config: &LingurideConfig) -> Result<(), LingurideError> {
        self.snapshot.borrow_mut().config = config.clone();
        Ok(())
    }
}

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

fn workspace_service(
    snapshot: WorkspaceSnapshot,
    now_millis: u64,
) -> WorkspaceService<
    MemoryWorkspaceStore,
    MemoryWorkspaceStore,
    MemoryWorkspaceStore,
    FixedClock,
    SequenceIdGenerator,
> {
    let store = MemoryWorkspaceStore::with_snapshot(snapshot);
    WorkspaceService::new(
        store.clone(),
        store.clone(),
        store,
        FixedClock(now_millis),
        SequenceIdGenerator::default(),
    )
}

#[test]
fn loads_workspace_snapshot_from_ports() {
    let snapshot = WorkspaceSnapshot {
        captures: vec![CaptureRecord {
            id: "capture-1".into(),
            source_app: CaptureSourceApp::ManualInput,
            capture_type: CaptureType::Manual,
            preferred_surface: PreferredSurface::Reader,
            origin_url: None,
            title: "Article".into(),
            text: "Text".into(),
            preview: "Text".into(),
            content_hash: "hash".into(),
            created_at: 1,
            truncated: false,
        }],
        ..WorkspaceSnapshot::default()
    };
    let service = workspace_service(snapshot.clone(), 10);

    assert_eq!(
        service
            .load_workspace_snapshot()
            .expect("snapshot should load"),
        snapshot
    );
}

#[test]
fn ingests_manual_capture_and_persists_reader_session() {
    let service = workspace_service(WorkspaceSnapshot::default(), 123);

    let capture = service
        .ingest_manual_capture(linguride_core::ManualCaptureInput {
            text: "Linguride writes tests first.".into(),
            title: Some("Manual".into()),
            origin_url: None,
        })
        .expect("capture should ingest");

    let snapshot = service
        .load_workspace_snapshot()
        .expect("snapshot should load");

    assert_eq!(capture.created_at, 123);
    assert_eq!(capture.id, "capture-translate-0");
    assert_eq!(snapshot.captures.len(), 1);
    assert_eq!(snapshot.sessions.len(), 1);
    assert_eq!(snapshot.sessions[0].capture_id.as_deref(), Some("capture-translate-0"));
    assert_eq!(snapshot.sessions[0].id, "session-reader-1");
}

#[test]
fn rejects_expired_envelope_without_persisting_state() {
    let service = workspace_service(WorkspaceSnapshot::default(), 30);
    let envelope = CaptureEnvelope {
        schema_version: 1,
        handoff_id: "handoff-1".into(),
        source_app: CaptureSourceApp::BrowserExtension,
        capture_type: CaptureType::Page,
        preferred_surface: PreferredSurface::Reader,
        origin_url: None,
        title: Some("Expired".into()),
        text: "Payload".into(),
        reader_mode: Some(ReaderMode::Translate),
        user_level: None,
        content_hash: linguride_core::support::make_hash("Payload"),
        created_at: 1,
        expires_at: 20,
        truncated: false,
    };

    let error = service
        .ingest_capture_envelope(&envelope)
        .expect_err("expired envelope should fail");

    assert_eq!(error.code, LingurideErrorCode::CaptureExpired);
    let snapshot = service
        .load_workspace_snapshot()
        .expect("snapshot should load");
    assert!(snapshot.captures.is_empty());
    assert!(snapshot.sessions.is_empty());
}

#[test]
fn normalizes_config_before_persisting() {
    let service = workspace_service(WorkspaceSnapshot::default(), 10);
    let config = service
        .save_workspace_config(LingurideConfig {
            api_base_url: " ".into(),
            model: String::new(),
            ..LingurideConfig::default()
        })
        .expect("config should save");

    assert_eq!(config.api_base_url, "https://api.deepseek.com");
    assert_eq!(config.model, "deepseek-chat");
    assert_eq!(
        service
            .load_workspace_snapshot()
            .expect("snapshot should load")
            .config,
        config
    );
}

#[test]
fn returns_not_found_when_reader_capture_is_missing() {
    let service = workspace_service(WorkspaceSnapshot::default(), 10);

    let error = service
        .run_reader_capture("missing", Some(ReaderMode::Translate))
        .expect_err("missing capture should fail");

    assert_eq!(error.code, LingurideErrorCode::NotFound);
}
