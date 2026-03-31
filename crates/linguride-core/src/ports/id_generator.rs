pub trait IdGeneratorPort {
    fn next_id(&self, namespace: &str) -> String;
}
