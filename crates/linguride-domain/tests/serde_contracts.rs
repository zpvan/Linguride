use linguride_domain::{
    CaptureEnvelope, CaptureSourceApp, CaptureType, CefrLevel, DifficultyReport, DifficultyTier,
    LingurideConfig, OpenAiAuthMode, PreferredSurface, ProviderKind, ReaderBlock, ReaderDocument,
    ReaderMode, ReaderResult, TextAnalysisHighlight, TextAnalysisMetrics, TextAnalysisSummary,
};
use serde_json::{json, Value};

#[test]
fn linguride_config_defaults_and_enum_serialization_are_stable() {
    let config = LingurideConfig::default();
    let json = serde_json::to_value(&config).expect("config should serialize");

    assert_eq!(config.provider, ProviderKind::DeepSeek);
    assert_eq!(config.openai_auth_mode, OpenAiAuthMode::ApiKey);
    assert_eq!(config.user_level, CefrLevel::A2);
    assert_eq!(config.reader_mode, ReaderMode::Translate);
    assert_eq!(json["provider"], "deepSeek");
    assert_eq!(json["openaiAuthMode"], "apiKey");
    assert_eq!(json["desktopHandoffEnabled"], true);
}

#[test]
fn capture_envelope_uses_camel_case_json_contract() {
    let envelope = CaptureEnvelope {
        schema_version: 1,
        handoff_id: "handoff-1".into(),
        source_app: CaptureSourceApp::BrowserExtension,
        capture_type: CaptureType::Page,
        preferred_surface: PreferredSurface::Reader,
        origin_url: Some("https://example.com".into()),
        title: Some("Sample".into()),
        text: "Text".into(),
        reader_mode: Some(ReaderMode::Translate),
        user_level: Some(CefrLevel::B1),
        content_hash: "hash".into(),
        created_at: 10,
        expires_at: 20,
        truncated: false,
    };

    let json = serde_json::to_value(&envelope).expect("envelope should serialize");

    assert_eq!(json["schemaVersion"], 1);
    assert_eq!(json["handoffId"], "handoff-1");
    assert_eq!(json["sourceApp"], "browserExtension");
    assert_eq!(json["captureType"], "page");
    assert_eq!(json["preferredSurface"], "reader");
    assert_eq!(json["readerMode"], "translate");
    assert_eq!(json["userLevel"], "B1");
}

#[test]
fn reader_result_roundtrips_through_json() {
    let result = ReaderResult {
        document: ReaderDocument {
            capture_id: "capture-1".into(),
            title: "Sample".into(),
            origin_url: Some("https://example.com".into()),
            mode: ReaderMode::Mixed,
            blocks: vec![ReaderBlock {
                id: "capture-1-0".into(),
                original_text: "Original".into(),
                rendered_text: "Rendered".into(),
            }],
        },
        difficulty: DifficultyReport {
            tier: DifficultyTier::Stretch,
            cefr_level: CefrLevel::B2,
            score: 63,
            reading_time_minutes: 1.2,
            suggestions: vec!["First".into(), "Second".into()],
        },
        summary: TextAnalysisSummary {
            normalized_text: "Original".into(),
            excerpt: "Original".into(),
            metrics: TextAnalysisMetrics {
                character_count: 8,
                word_count: 1,
                sentence_count: 1,
                paragraph_count: 1,
                average_word_length: 8.0,
                average_sentence_length: 1.0,
                estimated_reading_minutes: 0.1,
            },
            highlights: vec![TextAnalysisHighlight {
                title: "Reading load".into(),
                detail: "One word.".into(),
            }],
        },
    };

    let json = serde_json::to_string(&result).expect("result should serialize");
    let decoded: ReaderResult = serde_json::from_str(&json).expect("result should deserialize");

    assert_eq!(decoded, result);
}

#[test]
fn enums_deserialize_from_expected_wire_values() {
    let payload = json!({
        "provider": "openAi",
        "openaiAuthMode": "oAuth",
        "apiBaseUrl": "https://api.openai.com",
        "model": "gpt-4.1",
        "userLevel": "C1",
        "readerMode": "paraphrase",
        "desktopHandoffEnabled": false
    });

    let decoded: LingurideConfig =
        serde_json::from_value::<LingurideConfig>(payload).expect("config should decode");

    assert_eq!(decoded.provider, ProviderKind::OpenAi);
    assert_eq!(decoded.openai_auth_mode, OpenAiAuthMode::OAuth);
    assert_eq!(decoded.user_level, CefrLevel::C1);
    assert_eq!(decoded.reader_mode, ReaderMode::Paraphrase);
    assert!(!decoded.desktop_handoff_enabled);
}

#[test]
fn capture_envelope_roundtrips_without_losing_optional_fields() {
    let payload = json!({
        "schemaVersion": 1,
        "handoffId": "handoff-1",
        "sourceApp": "desktopApp",
        "captureType": "selection",
        "preferredSurface": "inbox",
        "originUrl": Value::Null,
        "title": Value::Null,
        "text": "Text",
        "readerMode": Value::Null,
        "userLevel": Value::Null,
        "contentHash": "hash",
        "createdAt": 10,
        "expiresAt": 20,
        "truncated": true
    });

    let decoded: CaptureEnvelope =
        serde_json::from_value(payload.clone()).expect("payload should decode");
    let reencoded = serde_json::to_value(decoded).expect("payload should encode");

    assert_eq!(reencoded, payload);
}
