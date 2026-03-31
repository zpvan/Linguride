use linguride_domain::{CaptureRecord, SessionKind, SessionRecord, SessionStatus};

use crate::support::now_millis;

pub fn create_reader_session(capture: &CaptureRecord) -> SessionRecord {
    let created_at = now_millis();

    SessionRecord {
        id: format!("session-reader-{}-{}", capture.id, created_at),
        kind: SessionKind::Reader,
        status: SessionStatus::Completed,
        capture_id: Some(capture.id.clone()),
        title: capture.title.clone(),
        created_at,
    }
}
