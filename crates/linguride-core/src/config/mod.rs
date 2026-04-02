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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_default_config() {
        assert_eq!(default_config(), LingurideConfig::default());
    }

    #[test]
    fn normalizes_empty_api_base_url_and_model() {
        let normalized = normalize_config(LingurideConfig {
            api_base_url: " ".into(),
            model: String::new(),
            ..LingurideConfig::default()
        });

        assert_eq!(normalized.api_base_url, "https://api.deepseek.com");
        assert_eq!(normalized.model, "deepseek-chat");
    }
}
