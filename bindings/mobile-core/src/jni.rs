use jni::objects::{JClass, JString};
use jni::sys::jstring;
use jni::JNIEnv;
use std::ptr::null_mut;

use crate::api::analyze_imported_article_json;

#[no_mangle]
pub extern "system" fn Java_com_linguride_android_mobile_MobileCoreBindings_analyzeImportedArticle(
    mut env: JNIEnv,
    _class: JClass,
    input: JString,
) -> jstring {
    let input: String = match env.get_string(&input) {
        Ok(value) => value.into(),
        Err(error) => {
            throw_illegal_state_if_possible(&mut env, format!("Invalid input string: {error}"));
            return null_mut();
        }
    };

    match analyze_imported_article_json(&input) {
        Ok(json) => match env.new_string(json) {
            Ok(output) => output.into_raw(),
            Err(error) => {
                throw_illegal_state_if_possible(
                    &mut env,
                    format!("Failed to allocate output string: {error}"),
                );
                null_mut()
            }
        },
        Err(message) => {
            throw_illegal_state_if_possible(&mut env, message);
            null_mut()
        }
    }
}

fn throw_illegal_state_if_possible(env: &mut JNIEnv, message: String) {
    if env.exception_check().unwrap_or(false) {
        return;
    }

    let _ = env.throw_new("java/lang/IllegalStateException", message);
}
