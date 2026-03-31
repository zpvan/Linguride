use linguride_domain::{LingurideConfig, LingurideError};

pub trait ConfigStorePort {
    fn load_config(&self) -> Result<LingurideConfig, LingurideError>;
    fn save_config(&self, config: &LingurideConfig) -> Result<(), LingurideError>;
}
