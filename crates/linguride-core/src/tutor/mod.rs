use linguride_domain::{TutorAction, TutorResult};

pub fn run_tutor_action(action: TutorAction) -> TutorResult {
    TutorResult {
        mode: action.mode,
        output_text: action.input_text,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn echoes_current_tutor_placeholder_behavior() {
        let result = run_tutor_action(TutorAction {
            mode: "rewrite".into(),
            input_text: "Hello".into(),
        });

        assert_eq!(result.mode, "rewrite");
        assert_eq!(result.output_text, "Hello");
    }
}
