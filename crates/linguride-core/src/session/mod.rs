use linguride_domain::{CaptureRecord, SessionKind, SessionRecord, SessionStatus};

use crate::ports::clock::ClockPort;
use crate::ports::id_generator::IdGeneratorPort;
use crate::support::{SystemClock, SystemIdGenerator};

pub fn create_reader_session(capture: &CaptureRecord) -> SessionRecord {
    create_reader_session_with_ports(capture, &SystemClock, &SystemIdGenerator)
}

pub fn create_reader_session_with_ports<Clock, IdGenerator>(
    capture: &CaptureRecord,
    clock: &Clock,
    id_generator: &IdGenerator,
) -> SessionRecord
where
    Clock: ClockPort,
    IdGenerator: IdGeneratorPort,
{
    let created_at = clock.now_millis();

    SessionRecord {
        id: id_generator.next_id("session-reader"),
        kind: SessionKind::Reader,
        status: SessionStatus::Completed,
        capture_id: Some(capture.id.clone()),
        title: capture.title.clone(),
        created_at,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use linguride_domain::{CaptureSourceApp, CaptureType, PreferredSurface};

    struct FixedClock(u64);

    impl ClockPort for FixedClock {
        fn now_millis(&self) -> u64 {
            self.0
        }
    }

    struct FixedIdGenerator;

    impl IdGeneratorPort for FixedIdGenerator {
        fn next_id(&self, namespace: &str) -> String {
            format!("{namespace}-fixed")
        }
    }

    #[test]
    fn creates_reader_session_with_injected_dependencies() {
        let capture = CaptureRecord {
            id: "capture-1".into(),
            source_app: CaptureSourceApp::ManualInput,
            capture_type: CaptureType::Manual,
            preferred_surface: PreferredSurface::Reader,
            origin_url: None,
            title: "Article".into(),
            text: "Text".into(),
            preview: "Text".into(),
            content_hash: "hash".into(),
            created_at: 12,
            truncated: false,
        };

        let session = create_reader_session_with_ports(
            &capture,
            &FixedClock(99),
            &FixedIdGenerator,
        );

        assert_eq!(session.id, "session-reader-fixed");
        assert_eq!(session.capture_id.as_deref(), Some("capture-1"));
        assert_eq!(session.created_at, 99);
        assert_eq!(session.title, "Article");
    }
}
