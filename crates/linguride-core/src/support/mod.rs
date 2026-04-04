use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::atomic::{AtomicU64, Ordering};
#[cfg(not(target_arch = "wasm32"))]
use std::time::{SystemTime, UNIX_EPOCH};

use crate::ports::clock::ClockPort;
use crate::ports::id_generator::IdGeneratorPort;

static NEXT_ID: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Copy, Default)]
pub struct SystemClock;

impl ClockPort for SystemClock {
    fn now_millis(&self) -> u64 {
        now_millis()
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct SystemIdGenerator;

impl IdGeneratorPort for SystemIdGenerator {
    fn next_id(&self, namespace: &str) -> String {
        let sequence = NEXT_ID.fetch_add(1, Ordering::Relaxed);
        format!("{namespace}-{}-{sequence:04x}", now_millis())
    }
}

#[cfg(target_arch = "wasm32")]
pub fn now_millis() -> u64 {
    js_sys::Date::now() as u64
}

#[cfg(not(target_arch = "wasm32"))]
pub fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

pub fn make_hash(value: &str) -> String {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

pub fn normalize_text(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub fn make_preview(text: &str, max_chars: usize) -> String {
    let mut preview = String::new();
    for character in text.chars().take(max_chars) {
        preview.push(character);
    }

    if text.chars().count() > max_chars {
        preview.push_str("...");
    }

    preview
}

pub fn split_blocks(text: &str) -> Vec<String> {
    let blocks = text
        .split("\n\n")
        .map(str::trim)
        .filter(|block| !block.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();

    if blocks.is_empty() {
        vec![text.trim().to_owned()]
    } else {
        blocks
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_text_whitespace() {
        assert_eq!(normalize_text("alpha \n beta\tgamma"), "alpha beta gamma");
    }

    #[test]
    fn builds_preview_with_ellipsis_when_needed() {
        assert_eq!(make_preview("abcdef", 3), "abc...");
        assert_eq!(make_preview("abc", 3), "abc");
    }

    #[test]
    fn splits_blocks_and_falls_back_to_trimmed_text() {
        assert_eq!(
            split_blocks("alpha\n\nbeta"),
            vec!["alpha".to_owned(), "beta".to_owned()]
        );
        assert_eq!(split_blocks(" single "), vec!["single".to_owned()]);
    }

    #[test]
    fn hashes_same_value_consistently() {
        assert_eq!(make_hash("linguride"), make_hash("linguride"));
    }

    #[test]
    fn system_id_generator_produces_unique_ids() {
        let generator = SystemIdGenerator;
        let first = generator.next_id("capture");
        let second = generator.next_id("capture");

        assert_ne!(first, second);
    }
}
