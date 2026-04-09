use mobile_core::api::analyze_imported_article_json;
use serde_json::Value;

#[test]
fn returns_reader_document_and_difficulty_for_manual_text() {
    let input = r#"{
      "title":"Sample",
      "originUrl":"https://example.com/article",
      "text":"One paragraph.\n\nSecond paragraph."
    }"#;

    let output = analyze_imported_article_json(input).expect("analysis should succeed");
    let parsed: Value = serde_json::from_str(&output).expect("output should be valid json");

    assert_eq!(parsed["capture"]["title"], "Sample");
    assert_eq!(parsed["capture"]["originUrl"], "https://example.com/article");
    assert_eq!(
        parsed["reader"]["document"]["captureId"],
        parsed["capture"]["id"]
    );
    assert!(parsed["reader"]["difficulty"].is_object());
    assert!(
        parsed["reader"]["document"]["blocks"]
            .as_array()
            .is_some_and(|blocks| !blocks.is_empty())
    );
}

#[test]
fn allows_missing_title_and_uses_capture_default_title() {
    let input = r#"{
      "originUrl":"https://example.com/article",
      "text":"One paragraph.\n\nSecond paragraph."
    }"#;

    let output = analyze_imported_article_json(input).expect("analysis should succeed");
    let parsed: Value = serde_json::from_str(&output).expect("output should be valid json");

    assert_eq!(parsed["capture"]["title"], "Manual Capture");
    assert_eq!(parsed["reader"]["document"]["title"], "Manual Capture");
}
