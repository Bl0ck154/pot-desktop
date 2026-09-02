use crate::config::{get, set};
use crate::window::updater_window;
use log::{info, warn};
use semver::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::Write;
#[cfg(target_os = "windows")]
use std::process::Command;
use tauri::Manager;

const UPDATE_MANIFEST_URL: &str =
    "https://github.com/Bl0ck154/pot-desktop/releases/latest/download/update.json";
const USER_AGENT: &str = "pot-bl0ck-updater";

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct UpdateManifest {
    version: String,
    release_name: String,
    body: String,
    published_at: Option<String>,
    release_url: String,
    download_url: String,
    asset_name: String,
    sha256: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    current_version: String,
    latest_version: String,
    release_name: String,
    body: String,
    published_at: Option<String>,
    release_url: String,
    available: bool,
    can_install: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    downloaded: u64,
    total: u64,
}

struct ResolvedUpdate {
    info: UpdateInfo,
    manifest: UpdateManifest,
}

fn parse_version(value: &str) -> Result<Version, String> {
    Version::parse(value.trim_start_matches('v'))
        .map_err(|error| format!("Invalid version '{value}': {error}"))
}

async fn resolve_update(app_handle: &tauri::AppHandle) -> Result<ResolvedUpdate, String> {
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|error| error.to_string())?;

    let manifest = client
        .get(UPDATE_MANIFEST_URL)
        .send()
        .await
        .map_err(|error| format!("Failed to check Bl0ck releases: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Bl0ck update manifest is unavailable: {error}"))?
        .json::<UpdateManifest>()
        .await
        .map_err(|error| format!("Invalid Bl0ck update manifest: {error}"))?;

    let current_version = app_handle.package_info().version.to_string();
    let current = parse_version(&current_version)?;
    let latest = parse_version(&manifest.version)?;

    #[cfg(target_os = "windows")]
    let can_install = manifest.asset_name.to_ascii_lowercase().ends_with(".exe")
        && manifest.sha256.len() == 64
        && !manifest.download_url.is_empty();

    #[cfg(not(target_os = "windows"))]
    let can_install = false;

    Ok(ResolvedUpdate {
        info: UpdateInfo {
            current_version,
            latest_version: latest.to_string(),
            release_name: manifest.release_name.clone(),
            body: manifest.body.clone(),
            published_at: manifest.published_at.clone(),
            release_url: manifest.release_url.clone(),
            available: latest > current,
            can_install,
        },
        manifest,
    })
}

pub fn check_update(app_handle: tauri::AppHandle) {
    let enable = match get("check_update") {
        Some(value) => value.as_bool().unwrap_or(true),
        None => {
            set("check_update", true);
            true
        }
    };

    if !enable {
        return;
    }

    tauri::async_runtime::spawn(async move {
        match resolve_update(&app_handle).await {
            Ok(update) => {
                if update.info.available {
                    info!(
                        "New Pot Bl0ck release available: {} -> {}",
                        update.info.current_version, update.info.latest_version
                    );
                    updater_window();
                }
            }
            Err(error) => warn!("Failed to check Pot Bl0ck updates: {error}"),
        }
    });
}

#[tauri::command(async)]
pub async fn check_bl0ck_update(app_handle: tauri::AppHandle) -> Result<UpdateInfo, String> {
    Ok(resolve_update(&app_handle).await?.info)
}

#[tauri::command(async)]
pub async fn install_bl0ck_update(app_handle: tauri::AppHandle) -> Result<(), String> {
    let update = resolve_update(&app_handle).await?;

    if !update.info.available {
        return Err("Pot Bl0ck is already up to date.".to_string());
    }
    if !update.info.can_install {
        return Err("This release cannot be installed automatically on this platform.".to_string());
    }

    let manifest = update.manifest;
    let expected_checksum = manifest.sha256.to_ascii_lowercase();

    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|error| error.to_string())?;

    let mut response = client
        .get(&manifest.download_url)
        .send()
        .await
        .map_err(|error| format!("Failed to download update: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Update download failed: {error}"))?;

    let total = response.content_length().unwrap_or(0);
    let update_path = std::env::temp_dir().join(&manifest.asset_name);
    let mut file =
        File::create(&update_path).map_err(|error| format!("Failed to create update file: {error}"))?;
    let mut hasher = Sha256::new();
    let mut downloaded = 0u64;

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("Failed while downloading update: {error}"))?
    {
        file.write_all(&chunk)
            .map_err(|error| format!("Failed to write update file: {error}"))?;
        hasher.update(&chunk);
        downloaded += chunk.len() as u64;

        let _ = app_handle.emit_all(
            "bl0ck://update-download-progress",
            DownloadProgress { downloaded, total },
        );
    }

    file.flush()
        .map_err(|error| format!("Failed to finish update file: {error}"))?;
    drop(file);

    let actual_checksum = format!("{:x}", hasher.finalize());
    if actual_checksum != expected_checksum {
        let _ = fs::remove_file(&update_path);
        return Err(format!(
            "Downloaded installer checksum mismatch. Expected {expected_checksum}, got {actual_checksum}."
        ));
    }

    #[cfg(target_os = "windows")]
    {
        let current_exe = std::env::current_exe()
            .map_err(|error| format!("Failed to locate Pot executable: {error}"))?;
        let installer_path = update_path.to_string_lossy().replace('\'', "''");
        let current_exe_path = current_exe.to_string_lossy().replace('\'', "''");

        // A detached helper waits until Pot is gone, installs silently, cleans up,
        // then starts the freshly installed executable from the same path.
        let script = format!(
            "$ErrorActionPreference='Stop'; \
             Start-Sleep -Milliseconds 1200; \
             $p = Start-Process -FilePath '{installer_path}' -ArgumentList '/S' -Wait -PassThru; \
             if ($p.ExitCode -ne 0) {{ exit $p.ExitCode }}; \
             Remove-Item -LiteralPath '{installer_path}' -Force -ErrorAction SilentlyContinue; \
             Start-Process -FilePath '{current_exe_path}'"
        );

        Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-WindowStyle",
                "Hidden",
                "-Command",
                &script,
            ])
            .spawn()
            .map_err(|error| format!("Failed to start installer helper: {error}"))?;

        info!(
            "Starting verified Pot Bl0ck update {} and exiting",
            update.info.latest_version
        );
        std::process::exit(0);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = fs::remove_file(&update_path);
        Err("In-app installation is currently available only on Windows.".to_string())
    }
}
