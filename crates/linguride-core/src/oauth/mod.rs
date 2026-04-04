use linguride_domain::{LingurideError, LingurideErrorCode, OpenAiOAuthStart};

use crate::ports::clock::ClockPort;
use crate::ports::id_generator::IdGeneratorPort;
use crate::support::{make_hash, SystemClock, SystemIdGenerator};

pub fn start_openai_oauth() -> Result<OpenAiOAuthStart, LingurideError> {
    start_openai_oauth_with_ports(&SystemClock, &SystemIdGenerator)
}

pub fn start_openai_oauth_with_ports<Clock, IdGenerator>(
    clock: &Clock,
    id_generator: &IdGenerator,
) -> Result<OpenAiOAuthStart, LingurideError>
where
    Clock: ClockPort,
    IdGenerator: IdGeneratorPort,
{
    let started_at = clock.now_millis();
    let state = format!("state-{}-{}", started_at, id_generator.next_id("oauth-state"));
    let code_verifier = format!("verifier-{}", make_hash(&state));
    let authorize_url = format!(
        "https://auth.openai.com/oauth/authorize?state={}&code_challenge={}",
        state,
        make_hash(&code_verifier)
    );

    if authorize_url.is_empty() {
        return Err(LingurideError::new(
            LingurideErrorCode::UnsupportedOperation,
            "Unable to construct OAuth authorize URL.",
        ));
    }

    Ok(OpenAiOAuthStart {
        authorize_url,
        state,
        code_verifier,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    struct FixedClock(u64);

    impl ClockPort for FixedClock {
        fn now_millis(&self) -> u64 {
            self.0
        }
    }

    struct FixedIdGenerator;

    impl IdGeneratorPort for FixedIdGenerator {
        fn next_id(&self, namespace: &str) -> String {
            format!("{namespace}-fixed")
        }
    }

    #[test]
    fn builds_oauth_start_payload_with_injected_dependencies() {
        let start = start_openai_oauth_with_ports(&FixedClock(42), &FixedIdGenerator)
            .expect("oauth should succeed");

        assert_eq!(start.state, "state-42-oauth-state-fixed");
        assert!(start.code_verifier.starts_with("verifier-"));
        assert!(start.authorize_url.contains("state=state-42-oauth-state-fixed"));
        assert!(start.authorize_url.contains("code_challenge="));
    }
}
