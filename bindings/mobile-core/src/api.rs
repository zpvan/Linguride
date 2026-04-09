use linguride_core::{capture, reader, ReaderMode};
use linguride_domain::{CaptureRecord, ReaderResult};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeImportedArticleInput {
    pub title: Option<String>,
    pub origin_url: Option<String>,
    pub text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeImportedArticleOutput {
    pub capture: CaptureRecord,
    pub reader: ReaderResult,
}

pub fn analyze_imported_article_json(input: &str) -> Result<String, String> {
    let payload: AnalyzeImportedArticleInput =
        serde_json::from_str(input).map_err(|error| error.to_string())?;

    let capture = capture::create_manual_capture(
        &payload.text,
        payload.title,
        payload.origin_url,
        ReaderMode::Translate,
    )
    .map_err(|error| error.message)?;

    let reader = reader::run_reader_mode(&capture, ReaderMode::Translate)
        .map_err(|error| error.message)?;

    serde_json::to_string(&AnalyzeImportedArticleOutput { capture, reader })
        .map_err(|error| error.to_string())
}
