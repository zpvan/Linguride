use linguride_domain::{TutorAction, TutorResult};

pub fn run_tutor_action(action: TutorAction) -> TutorResult {
    TutorResult {
        mode: action.mode,
        output_text: action.input_text,
    }
}
