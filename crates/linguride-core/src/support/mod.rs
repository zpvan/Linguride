use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::time::{SystemTime, UNIX_EPOCH};

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
