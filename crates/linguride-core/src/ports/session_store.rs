use linguride_domain::{LingurideError, SessionRecord};

pub trait SessionStorePort {
    fn list_sessions(&self) -> Result<Vec<SessionRecord>, LingurideError>;
    fn save_session(&self, session: &SessionRecord) -> Result<(), LingurideError>;
}
