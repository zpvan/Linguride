use linguride_domain::LingurideError;

pub trait CredentialStorePort {
    fn load_secret(&self, namespace: &str, key: &str) -> Result<Option<String>, LingurideError>;
    fn save_secret(
        &self,
        namespace: &str,
        key: &str,
        value: &str,
    ) -> Result<(), LingurideError>;
    fn delete_secret(&self, namespace: &str, key: &str) -> Result<(), LingurideError>;
}
