use linguride_domain::{
    CaptureEnvelope, CaptureRecord, LingurideConfig, LingurideError, LingurideErrorCode,
    ReaderMode, ReaderResult, SessionRecord,
};
use serde::{Deserialize, Serialize};

use crate::capture;
use crate::config;
use crate::ports::capture_store::CaptureStorePort;
use crate::ports::clock::ClockPort;
use crate::ports::config_store::ConfigStorePort;
use crate::ports::id_generator::IdGeneratorPort;
use crate::ports::session_store::SessionStorePort;
use crate::reader;
use crate::session;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshot {
    pub config: LingurideConfig,
    pub captures: Vec<CaptureRecord>,
    pub sessions: Vec<SessionRecord>,
}

impl Default for WorkspaceSnapshot {
    fn default() -> Self {
        Self {
            config: LingurideConfig::default(),
            captures: Vec::new(),
            sessions: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ManualCaptureInput {
    pub text: String,
    pub title: Option<String>,
    pub origin_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct WorkspaceService<CaptureStore, SessionStore, ConfigStore, Clock, IdGenerator> {
    capture_store: CaptureStore,
    session_store: SessionStore,
    config_store: ConfigStore,
    clock: Clock,
    id_generator: IdGenerator,
}

impl<CaptureStore, SessionStore, ConfigStore, Clock, IdGenerator>
    WorkspaceService<CaptureStore, SessionStore, ConfigStore, Clock, IdGenerator>
{
    pub fn new(
        capture_store: CaptureStore,
        session_store: SessionStore,
        config_store: ConfigStore,
        clock: Clock,
        id_generator: IdGenerator,
    ) -> Self {
        Self {
            capture_store,
            session_store,
            config_store,
            clock,
            id_generator,
        }
    }
}

impl<CaptureStore, SessionStore, ConfigStore, Clock, IdGenerator>
    WorkspaceService<CaptureStore, SessionStore, ConfigStore, Clock, IdGenerator>
where
    CaptureStore: CaptureStorePort,
    SessionStore: SessionStorePort,
    ConfigStore: ConfigStorePort,
    Clock: ClockPort,
    IdGenerator: IdGeneratorPort,
{
    pub fn load_workspace_snapshot(&self) -> Result<WorkspaceSnapshot, LingurideError> {
        Ok(WorkspaceSnapshot {
            config: self.config_store.load_config()?,
            captures: self.capture_store.list_captures()?,
            sessions: self.session_store.list_sessions()?,
        })
    }

    pub fn ingest_manual_capture(
        &self,
        input: ManualCaptureInput,
    ) -> Result<CaptureRecord, LingurideError> {
        let capture = capture::create_manual_capture_with_ports(
            &input.text,
            input.title,
            input.origin_url,
            ReaderMode::Translate,
            &self.clock,
            &self.id_generator,
        )?;

        self.capture_store.save_capture(&capture)?;
        let session = session::create_reader_session_with_ports(
            &capture,
            &self.clock,
            &self.id_generator,
        );
        self.session_store.save_session(&session)?;

        Ok(capture)
    }

    pub fn ingest_capture_envelope(
        &self,
        envelope: &CaptureEnvelope,
    ) -> Result<CaptureRecord, LingurideError> {
        let capture = capture::ingest_capture_envelope(envelope, self.clock.now_millis())?;

        self.capture_store.save_capture(&capture)?;
        let session = session::create_reader_session_with_ports(
            &capture,
            &self.clock,
            &self.id_generator,
        );
        self.session_store.save_session(&session)?;

        Ok(capture)
    }

    pub fn run_reader_capture(
        &self,
        capture_id: &str,
        mode: Option<ReaderMode>,
    ) -> Result<ReaderResult, LingurideError> {
        let capture = self
            .capture_store
            .list_captures()?
            .into_iter()
            .find(|item| item.id == capture_id)
            .ok_or_else(|| {
                LingurideError::new(LingurideErrorCode::NotFound, "Capture not found.")
            })?;

        reader::run_reader_mode(&capture, mode.unwrap_or_default())
    }

    pub fn save_workspace_config(
        &self,
        next_config: LingurideConfig,
    ) -> Result<LingurideConfig, LingurideError> {
        let normalized = config::normalize_config(next_config);
        self.config_store.save_config(&normalized)?;
        Ok(normalized)
    }
}
