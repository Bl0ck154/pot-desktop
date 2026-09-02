use crate::config::{get, set};
use crate::window::{input_translate, ocr_recognize, ocr_translate, selection_translate};
use crate::APP;
use log::{info, warn};

#[cfg(not(target_os = "windows"))]
use tauri::{AppHandle, GlobalShortcutManager};

#[cfg(target_os = "windows")]
use std::collections::HashMap;
#[cfg(target_os = "windows")]
use std::sync::{mpsc, OnceLock};
#[cfg(target_os = "windows")]
use std::thread;
#[cfg(target_os = "windows")]
use std::time::Duration;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    PeekMessageW, RegisterHotKey, UnregisterHotKey, HOT_KEY_MODIFIERS, MOD_ALT, MOD_CONTROL,
    MOD_NOREPEAT, MOD_SHIFT, MOD_WIN, MSG, PM_REMOVE, WM_HOTKEY,
};

const SHORTCUT_NAMES: [&str; 4] = [
    "hotkey_selection_translate",
    "hotkey_input_translate",
    "hotkey_ocr_recognize",
    "hotkey_ocr_translate",
];

fn configured_shortcut(name: &str, key: &str) -> String {
    if !key.is_empty() {
        return key.to_string();
    }

    match get(name) {
        Some(v) => v.as_str().unwrap_or_default().to_string(),
        None => {
            set(name, "");
            String::new()
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn register<F>(app_handle: &AppHandle, name: &str, handler: F, key: &str) -> Result<(), String>
where
    F: Fn() + Send + 'static,
{
    let hotkey = configured_shortcut(name, key);

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

#[cfg(not(target_os = "windows"))]
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

#[cfg(target_os = "windows")]
#[derive(Clone)]
struct NativeRegistration {
    id: i32,
    shortcut: String,
}

#[cfg(target_os = "windows")]
enum NativeCommand {
    Register {
        name: String,
        shortcut: String,
        response: mpsc::Sender<Result<(), String>>,
    },
    Replace {
        name: String,
        shortcut: String,
        response: mpsc::Sender<Result<(), String>>,
    },
}

#[cfg(target_os = "windows")]
static NATIVE_HOTKEY_TX: OnceLock<mpsc::Sender<NativeCommand>> = OnceLock::new();

#[cfg(target_os = "windows")]
fn shortcut_id(name: &str) -> Result<i32, String> {
    match name {
        "hotkey_selection_translate" => Ok(0xB101),
        "hotkey_input_translate" => Ok(0xB102),
        "hotkey_ocr_recognize" => Ok(0xB103),
        "hotkey_ocr_translate" => Ok(0xB104),
        _ => Err(format!("Unknown global shortcut: {}", name)),
    }
}

#[cfg(target_os = "windows")]
fn parse_windows_shortcut(shortcut: &str) -> Result<(HOT_KEY_MODIFIERS, u32), String> {
    if shortcut.trim().is_empty() {
        return Err("Shortcut is empty".to_string());
    }

    let mut modifier_bits = MOD_NOREPEAT.0;
    let mut key: Option<&str> = None;

    for part in shortcut.split('+').filter(|part| !part.is_empty()) {
        match part.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => modifier_bits |= MOD_CONTROL.0,
            "shift" => modifier_bits |= MOD_SHIFT.0,
            "alt" => modifier_bits |= MOD_ALT.0,
            "super" | "win" | "command" => modifier_bits |= MOD_WIN.0,
            _ => {
                if key.is_some() {
                    return Err(format!("Unsupported shortcut: {}", shortcut));
                }
                key = Some(part);
            }
        }
    }

    let key = key.ok_or_else(|| format!("Shortcut has no key: {}", shortcut))?;
    let upper = key.to_ascii_uppercase();

    let vk = if upper.len() == 1 {
        let ch = upper.as_bytes()[0];
        if ch.is_ascii_alphanumeric() {
            ch as u32
        } else {
            match key {
                "`" => 0xC0,
                "\\" => 0xDC,
                "[" => 0xDB,
                "]" => 0xDD,
                "," => 0xBC,
                "=" => 0xBB,
                "-" => 0xBD,
                "." => 0xBE,
                "'" => 0xDE,
                ";" => 0xBA,
                "/" => 0xBF,
                _ => return Err(format!("Unsupported shortcut key: {}", key)),
            }
        }
    } else if let Some(number) = upper.strip_prefix('F') {
        let number = number
            .parse::<u32>()
            .map_err(|_| format!("Unsupported shortcut key: {}", key))?;
        if (1..=24).contains(&number) {
            0x70 + number - 1
        } else {
            return Err(format!("Unsupported shortcut key: {}", key));
        }
    } else if let Some(number) = upper.strip_prefix("NUM") {
        if let Ok(number) = number.parse::<u32>() {
            if number <= 9 {
                0x60 + number
            } else {
                return Err(format!("Unsupported shortcut key: {}", key));
            }
        } else {
            match upper.as_str() {
                "NUMADD" => 0x6B,
                "NUMSUBTRACT" => 0x6D,
                "NUMMULTIPLY" => 0x6A,
                "NUMDIVIDE" => 0x6F,
                "NUMDECIMAL" => 0x6E,
                _ => return Err(format!("Unsupported shortcut key: {}", key)),
            }
        }
    } else {
        match upper.as_str() {
            "BACKSPACE" => 0x08,
            "TAB" => 0x09,
            "PAUSE" => 0x13,
            "CAPSLOCK" => 0x14,
            "ESC" | "ESCAPE" => 0x1B,
            "CONVERT" => 0x1C,
            "SPACE" => 0x20,
            "PAGEUP" => 0x21,
            "PAGEDOWN" => 0x22,
            "END" => 0x23,
            "HOME" => 0x24,
            "LEFT" => 0x25,
            "UP" => 0x26,
            "RIGHT" => 0x27,
            "DOWN" => 0x28,
            "PRINTSCREEN" => 0x2C,
            "INSERT" => 0x2D,
            "DELETE" => 0x2E,
            "HELP" => 0x2F,
            "CONTEXTMENU" => 0x5D,
            "SUSPEND" => 0x5F,
            "SCROLLLOCK" => 0x91,
            "PLUS" => 0x6B,
            _ => return Err(format!("Unsupported shortcut key: {}", key)),
        }
    };

    Ok((HOT_KEY_MODIFIERS(modifier_bits), vk))
}

#[cfg(target_os = "windows")]
fn dispatch_windows_hotkey(id: i32) {
    let name = match id {
        0xB101 => "hotkey_selection_translate",
        0xB102 => "hotkey_input_translate",
        0xB103 => "hotkey_ocr_recognize",
        0xB104 => "hotkey_ocr_translate",
        _ => return,
    };

    info!("[hotkey][native] FIRED {}", name);

    let app = APP.get().unwrap().clone();
    let run_result = app.run_on_main_thread(move || match id {
        0xB101 => selection_translate(),
        0xB102 => input_translate(),
        0xB103 => ocr_recognize(),
        0xB104 => ocr_translate(),
        _ => {}
    });

    if let Err(error) = run_result {
        warn!(
            "[hotkey][native] failed to dispatch {} on main thread: {:?}",
            name, error
        );
    }
}

#[cfg(target_os = "windows")]
fn register_native(
    registrations: &mut HashMap<String, NativeRegistration>,
    name: &str,
    shortcut: &str,
) -> Result<(), String> {
    let id = shortcut_id(name)?;

    if shortcut.is_empty() {
        if let Some(existing) = registrations.remove(name) {
            unsafe {
                UnregisterHotKey(None, existing.id)
                    .map_err(|error| format!("Failed to unregister {}: {}", existing.shortcut, error))?;
            }
            info!("[hotkey][native] disabled {}", name);
        }
        return Ok(());
    }

    if registrations
        .get(name)
        .map(|registered| registered.shortcut == shortcut)
        .unwrap_or(false)
    {
        return Ok(());
    }

    let (modifiers, vk) = parse_windows_shortcut(shortcut)?;
    let old = registrations.remove(name);

    if let Some(existing) = &old {
        unsafe {
            UnregisterHotKey(None, existing.id).map_err(|error| {
                format!(
                    "Failed to unregister old shortcut {} for {}: {}",
                    existing.shortcut, name, error
                )
            })?;
        }
    }

    info!("[hotkey][native] trying to register {} for {}", shortcut, name);
    let register_result = unsafe { RegisterHotKey(None, id, modifiers, vk) };

    match register_result {
        Ok(()) => {
            registrations.insert(
                name.to_string(),
                NativeRegistration {
                    id,
                    shortcut: shortcut.to_string(),
                },
            );
            info!("[hotkey][native] registered {} for {}", shortcut, name);
            Ok(())
        }
        Err(error) => {
            let new_error = format!("Failed to register {} for {}: {}", shortcut, name, error);
            warn!("[hotkey][native] {}", new_error);

            if let Some(existing) = old {
                if let Ok((old_modifiers, old_vk)) = parse_windows_shortcut(&existing.shortcut) {
                    match unsafe { RegisterHotKey(None, existing.id, old_modifiers, old_vk) } {
                        Ok(()) => {
                            registrations.insert(name.to_string(), existing.clone());
                            info!(
                                "[hotkey][native] restored {} for {} after failed replacement",
                                existing.shortcut, name
                            );
                        }
                        Err(restore_error) => {
                            warn!(
                                "[hotkey][native] failed to restore {} for {}: {}",
                                existing.shortcut, name, restore_error
                            );
                        }
                    }
                }
            }

            Err(new_error)
        }
    }
}

#[cfg(target_os = "windows")]
fn native_hotkey_thread(rx: mpsc::Receiver<NativeCommand>) {
    info!("[hotkey][native] Windows native hotkey service started");
    let mut registrations: HashMap<String, NativeRegistration> = HashMap::new();

    loop {
        while let Ok(command) = rx.try_recv() {
            match command {
                NativeCommand::Register {
                    name,
                    shortcut,
                    response,
                }
                | NativeCommand::Replace {
                    name,
                    shortcut,
                    response,
                } => {
                    let result = register_native(&mut registrations, &name, &shortcut);
                    let _ = response.send(result);
                }
            }
        }

        unsafe {
            let mut message = MSG::default();
            while PeekMessageW(&mut message, None, WM_HOTKEY, WM_HOTKEY, PM_REMOVE).as_bool() {
                dispatch_windows_hotkey(message.wParam.0 as i32);
            }
        }

        thread::sleep(Duration::from_millis(8));
    }
}

#[cfg(target_os = "windows")]
fn native_hotkey_sender() -> &'static mpsc::Sender<NativeCommand> {
    NATIVE_HOTKEY_TX.get_or_init(|| {
        let (tx, rx) = mpsc::channel();
        thread::Builder::new()
            .name("pot-native-hotkeys".to_string())
            .spawn(move || native_hotkey_thread(rx))
            .expect("Failed to start native Windows hotkey thread");
        tx
    })
}

#[cfg(target_os = "windows")]
fn send_native_command(command: NativeCommand, response_rx: mpsc::Receiver<Result<(), String>>) -> Result<(), String> {
    native_hotkey_sender()
        .send(command)
        .map_err(|error| format!("Native hotkey service is unavailable: {}", error))?;

    response_rx
        .recv_timeout(Duration::from_secs(2))
        .map_err(|error| format!("Native hotkey service timed out: {}", error))?
}

#[cfg(target_os = "windows")]
fn register_named_windows(name: &str, key: &str) -> Result<(), String> {
    if !SHORTCUT_NAMES.contains(&name) {
        return Err(format!("Unknown global shortcut: {}", name));
    }

    let shortcut = configured_shortcut(name, key);
    let (response_tx, response_rx) = mpsc::channel();
    let command = NativeCommand::Register {
        name: name.to_string(),
        shortcut,
        response: response_tx,
    };
    send_native_command(command, response_rx)
}

#[cfg(target_os = "windows")]
fn replace_named_windows(name: &str, shortcut: &str) -> Result<(), String> {
    if !SHORTCUT_NAMES.contains(&name) {
        return Err(format!("Unknown global shortcut: {}", name));
    }

    let (response_tx, response_rx) = mpsc::channel();
    let command = NativeCommand::Replace {
        name: name.to_string(),
        shortcut: shortcut.to_string(),
        response: response_tx,
    };
    send_native_command(command, response_rx)
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

// Register global shortcuts. On Windows we bypass Tauri's global shortcut
// callback path and use RegisterHotKey on a dedicated message-pump thread. This
// avoids the state seen on some Windows 10/11 machines where Tauri reports a
// successful registration but never delivers the callback.
pub fn register_shortcut(shortcut: &str) -> Result<(), String> {
    if shortcut == "all" {
        let mut errors = Vec::new();
        for name in SHORTCUT_NAMES {
            #[cfg(target_os = "windows")]
            let result = register_named_windows(name, "");
            #[cfg(not(target_os = "windows"))]
            let result = register_named(APP.get().unwrap(), name, "");

            if let Err(error) = result {
                errors.push(format!("{}: {}", name, error));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors.join("\n"))
        }
    } else {
        #[cfg(target_os = "windows")]
        {
            register_named_windows(shortcut, "")
        }
        #[cfg(not(target_os = "windows"))]
        {
            register_named(APP.get().unwrap(), shortcut, "")
        }
    }
}

#[tauri::command]
pub fn register_shortcut_by_frontend(name: &str, shortcut: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        replace_named_windows(name, shortcut)
    }
    #[cfg(not(target_os = "windows"))]
    {
        register_named(APP.get().unwrap(), name, shortcut)
    }
}

// Replace a shortcut transactionally: register the replacement first where the
// platform allows it, or restore the old shortcut if Windows rejects the new one.
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

    if shortcut_used_by_other(name, new_shortcut) {
        return Err(format!("Shortcut {} is already used by Pot", new_shortcut));
    }

    #[cfg(target_os = "windows")]
    {
        replace_named_windows(name, new_shortcut)?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let app_handle = APP.get().unwrap();

        if !new_shortcut.is_empty() {
            register_named(app_handle, name, new_shortcut)?;
        }

        if !old_shortcut.is_empty() && !shortcut_used_by_other(name, old_shortcut) {
            if let Err(error) = app_handle
                .global_shortcut_manager()
                .unregister(old_shortcut)
            {
                warn!(
                    "[hotkey] failed to unregister old shortcut {} for {}: {:?}",
                    old_shortcut, name, error
                );
            }
        }
    }

    set(name, new_shortcut);
    info!(
        "[hotkey] replaced shortcut for {}: '{}' -> '{}'",
        name, old_shortcut, new_shortcut
    );
    Ok(())
}
