use linguride_domain::LingurideConfig;

pub fn default_config() -> LingurideConfig {
    LingurideConfig::default()
}

pub fn normalize_config(config: LingurideConfig) -> LingurideConfig {
    let mut normalized = config;

    if normalized.api_base_url.trim().is_empty() {
        normalized.api_base_url = LingurideConfig::default().api_base_url;
    }

    if normalized.model.trim().is_empty() {
        normalized.model = LingurideConfig::default().model;
    }

    normalized
}
