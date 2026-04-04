use linguride_domain::{CaptureRecord, LingurideError};

pub trait CaptureStorePort {
    fn list_captures(&self) -> Result<Vec<CaptureRecord>, LingurideError>;
    fn save_capture(&self, capture: &CaptureRecord) -> Result<(), LingurideError>;
}
