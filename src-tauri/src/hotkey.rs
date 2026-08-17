use crate::config::{get, set};
use crate::window::{input_translate, ocr_recognize, ocr_translate, selection_translate};
use crate::APP;
use log::{info, warn};
use tauri::{AppHandle, GlobalShortcutManager};

const SHORTCUT_NAMES: [&str; 4] = [
    "hotkey_selection_translate",
    "hotkey_input_translate",
    "hotkey_ocr_recognize",
    "hotkey_ocr_translate",
];

fn register<F>(app_handle: &AppHandle, name: &str, handler: F, key: &str) -> Result<(), String>
where
    F: Fn() + Send + 'static,
{
    let hotkey = if key.is_empty() {
        match get(name) {
            Some(v) => v.as_str().unwrap_or_default().to_string(),
            None => {
                set(name, "");
                String::new()
            }
        }
    } else {
        key.to_string()
    };

    if !hotkey.is_empty() {
        info!("[hotkey] trying to register {} for {}", hotkey, name);
        match app_handle
            .global_shortcut_manager()
            .register(hotkey.as_str(), handler)
        {
            Ok(()) => {
                info!("[hotkey] registered {} for {}", hotkey, name);
            }
            Err(e) => {
                warn!("[hotkey] failed to register {} for {}: {:?}", hotkey, name, e);
                return Err(e.to_string());
            }
        };
    }
    Ok(())
}

fn register_named(app_handle: &AppHandle, name: &str, key: &str) -> Result<(), String> {
    match name {
        "hotkey_selection_translate" => register(
            app_handle,
            name,
            || {
                info!("[hotkey] FIRED hotkey_selection_translate");
                selection_translate();
            },
            key,
        ),
        "hotkey_input_translate" => register(
            app_handle,
            name,
            || {
                info!("[hotkey] FIRED hotkey_input_translate");
                input_translate();
            },
            key,
        ),
        "hotkey_ocr_recognize" => register(
            app_handle,
            name,
            || {
                info!("[hotkey] FIRED hotkey_ocr_recognize");
                ocr_recognize();
            },
            key,
        ),
        "hotkey_ocr_translate" => register(
            app_handle,
            name,
            || {
                info!("[hotkey] FIRED hotkey_ocr_translate");
                ocr_translate();
            },
            key,
        ),
        _ => Err(format!("Unknown global shortcut: {}", name)),
    }
}

fn shortcut_used_by_other(name: &str, shortcut: &str) -> bool {
    if shortcut.is_empty() {
        return false;
    }

    SHORTCUT_NAMES.iter().any(|other_name| {
        *other_name != name
            && get(other_name)
                .and_then(|value| value.as_str().map(|value| value == shortcut))
                .unwrap_or(false)
    })
}

// Register global shortcuts. When registering all shortcuts, always try every one
// so a single Windows/global-shortcut conflict cannot disable the shortcuts after it.
pub fn register_shortcut(shortcut: &str) -> Result<(), String> {
    let app_handle = APP.get().unwrap();

    if shortcut == "all" {
        let mut errors = Vec::new();
        for name in SHORTCUT_NAMES {
            if let Err(error) = register_named(app_handle, name, "") {
                errors.push(format!("{}: {}", name, error));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors.join("\n"))
        }
    } else {
        register_named(app_handle, shortcut, "")
    }
}

#[tauri::command]
pub fn register_shortcut_by_frontend(name: &str, shortcut: &str) -> Result<(), String> {
    let app_handle = APP.get().unwrap();
    register_named(app_handle, name, shortcut)
}

// Replace a shortcut transactionally: register the replacement first and only
// then release the old shortcut and persist the new value. If registration fails,
// the old shortcut and config stay untouched.
#[tauri::command]
pub fn replace_shortcut_by_frontend(
    name: &str,
    old_shortcut: &str,
    new_shortcut: &str,
) -> Result<(), String> {
    if !SHORTCUT_NAMES.contains(&name) {
        return Err(format!("Unknown global shortcut: {}", name));
    }

    if old_shortcut == new_shortcut {
        set(name, new_shortcut);
        return Ok(());
    }

    let app_handle = APP.get().unwrap();

    if !new_shortcut.is_empty() {
        register_named(app_handle, name, new_shortcut)?;
    }

    if !old_shortcut.is_empty() && !shortcut_used_by_other(name, old_shortcut) {
        if let Err(error) = app_handle
            .global_shortcut_manager()
            .unregister(old_shortcut)
        {
            // The old shortcut may already be missing (the broken state this fix is
            // designed to recover from). The newly registered shortcut is still valid.
            warn!(
                "[hotkey] failed to unregister old shortcut {} for {}: {:?}",
                old_shortcut, name, error
            );
        }
    }

    set(name, new_shortcut);
    info!(
        "[hotkey] replaced shortcut for {}: '{}' -> '{}'",
        name, old_shortcut, new_shortcut
    );
    Ok(())
}
