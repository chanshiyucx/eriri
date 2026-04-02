use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use crate::models::Config;

pub struct ConfigState(pub Mutex<Config>);

fn get_config_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("config.json"))
}

fn default_cache_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("com.xin.eriri"))
}

pub fn get_configured_cache_dir(app: &AppHandle) -> Option<PathBuf> {
    get(app)
        .cache_dir
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
}

fn get_store_dir(app: &AppHandle) -> PathBuf {
    if let Some(base) = get_configured_cache_dir(app) {
        let store_dir = base.join("store");
        if store_dir.exists() || fs::create_dir_all(&store_dir).is_ok() {
            return store_dir;
        }
    }

    default_cache_dir(app).join("store")
}

fn load_from_disk(app: &AppHandle) -> Config {
    get_config_path(app)
        .filter(|p| p.exists())
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn init(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let config = load_from_disk(app.handle());
    app.manage(ConfigState(Mutex::new(config)));
    Ok(())
}

pub fn get(app: &AppHandle) -> Config {
    app.try_state::<ConfigState>()
        .and_then(|state| state.0.lock().ok().map(|g| g.clone()))
        .unwrap_or_else(|| load_from_disk(app))
}

pub fn save_config(app: &AppHandle, config: &Config) -> Result<(), String> {
    if let Some(config_path) = get_config_path(app) {
        if let Some(parent) = config_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        fs::write(config_path, content).map_err(|e| e.to_string())?;

        // Update in-memory state
        if let Some(state) = app.try_state::<ConfigState>() {
            if let Ok(mut state_config) = state.0.lock() {
                *state_config = config.clone();
            }
        }

        Ok(())
    } else {
        Err("Failed to resolve config path".to_string())
    }
}

#[tauri::command]
pub fn read_store_data(app: AppHandle, key: String) -> Option<String> {
    let store_dir = get_store_dir(&app);
    let file_path = store_dir.join(format!("{key}.json"));

    if file_path.exists() {
        fs::read_to_string(file_path).ok()
    } else {
        None
    }
}

#[tauri::command]
pub fn write_store_data(app: AppHandle, key: String, data: String) -> Result<(), String> {
    let store_dir = get_store_dir(&app);

    // Ensure store directory exists
    if !store_dir.exists() {
        fs::create_dir_all(&store_dir).map_err(|e| e.to_string())?;
    }

    let file_path = store_dir.join(format!("{key}.json"));
    let tmp_path = store_dir.join(format!("{key}.tmp"));

    // Write to temp file first
    fs::write(&tmp_path, data).map_err(|e| e.to_string())?;

    // Atomic rename
    fs::rename(&tmp_path, file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_store_data(app: AppHandle, key: String) -> Result<(), String> {
    let store_dir = get_store_dir(&app);
    let file_path = store_dir.join(format!("{key}.json"));
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
