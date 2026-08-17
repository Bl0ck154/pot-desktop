use log::info;
use std::fs;
use std::path::Path;

const GEMINI_PLUGIN_DIR: &str = "plugin.gemini-ocr-updated";
const GEMINI_INFO: &str = include_str!("../bundled_plugins/gemini-ocr/info.json");
const GEMINI_MAIN: &str = include_str!("../bundled_plugins/gemini-ocr/main.js");
const GEMINI_ICON: &str = include_str!("../bundled_plugins/gemini-ocr/gemini.svg");

pub fn install_bundled_plugins(app: &tauri::App) -> Result<(), String> {
    let config_dir = dirs::config_dir().ok_or_else(|| "Unable to resolve config directory".to_string())?;
    let plugin_dir = config_dir
        .join(app.config().tauri.bundle.identifier.clone())
        .join("plugins")
        .join("recognize")
        .join(GEMINI_PLUGIN_DIR);

    let files = [
        ("info.json", GEMINI_INFO),
        ("main.js", GEMINI_MAIN),
        ("gemini.svg", GEMINI_ICON),
    ];

    // Respect a complete existing installation. This lets the user manually
    // update or customize the plugin without it being overwritten on startup.
    if files
        .iter()
        .all(|(name, _)| Path::new(&plugin_dir).join(name).exists())
    {
        info!("Bundled Gemini OCR plugin already installed");
        return Ok(());
    }

    fs::create_dir_all(&plugin_dir)
        .map_err(|error| format!("Unable to create bundled plugin directory: {}", error))?;

    for (name, content) in files {
        fs::write(plugin_dir.join(name), content)
            .map_err(|error| format!("Unable to install bundled plugin file {}: {}", name, error))?;
    }

    info!("Installed bundled Gemini OCR plugin to {:?}", plugin_dir);
    Ok(())
}
