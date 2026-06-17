use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{AppHandle, Manager, Runtime};

use crate::models::Config;

pub struct ConfigState(pub Mutex<Config>);

fn validate_store_key(key: &str) -> Result<(), String> {
    if !key.is_empty()
        && key
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
    {
        Ok(())
    } else {
        Err("Invalid store key".to_string())
    }
}

fn store_file_path(store_dir: &Path, key: &str, extension: &str) -> Result<PathBuf, String> {
    validate_store_key(key)?;
    Ok(store_dir.join(format!("{key}.{extension}")))
}

fn get_config_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("config.json"))
}

fn default_cache_dir<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    app.path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("com.xin.eriri"))
}

pub fn get_configured_cache_dir<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    get(app)
        .cache_dir
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
}

pub fn get_store_dir<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    if let Some(base) = get_configured_cache_dir(app) {
        let store_dir = base.join("store");
        if store_dir.exists() || fs::create_dir_all(&store_dir).is_ok() {
            return store_dir;
        }
    }

    default_cache_dir(app).join("store")
}

fn load_from_disk<R: Runtime>(app: &AppHandle<R>) -> Config {
    get_config_path(app)
        .filter(|p| p.exists())
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn init<R: Runtime>(app: &mut tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    let config = load_from_disk(app.handle());
    app.manage(ConfigState(Mutex::new(config)));
    Ok(())
}

pub fn get<R: Runtime>(app: &AppHandle<R>) -> Config {
    app.try_state::<ConfigState>()
        .and_then(|state| state.0.lock().ok().map(|g| g.clone()))
        .unwrap_or_else(|| load_from_disk(app))
}

pub fn save_config<R: Runtime>(app: &AppHandle<R>, config: &Config) -> Result<(), String> {
    if let Some(config_path) = get_config_path(app) {
        if let Some(parent) = config_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        fs::write(config_path, content).map_err(|e| e.to_string())?;

        // Update in-memory state
        if let Some(state) = app.try_state::<ConfigState>()
            && let Ok(mut state_config) = state.0.lock()
        {
            *state_config = config.clone();
        }

        Ok(())
    } else {
        Err("Failed to resolve config path".to_string())
    }
}

pub fn read_store_data<R: Runtime>(app: AppHandle<R>, key: String) -> Option<String> {
    let store_dir = get_store_dir(&app);
    let file_path = store_file_path(&store_dir, &key, "json").ok()?;
    fs::read_to_string(file_path).ok()
}

/// Monotonic counter giving each in-flight write its own temp file, so
/// concurrent writes to the same key can't clobber each other's `.tmp`.
static TMP_SEQ: AtomicU64 = AtomicU64::new(0);

pub fn write_store_data<R: Runtime>(
    app: AppHandle<R>,
    key: String,
    data: String,
) -> Result<(), String> {
    let store_dir = get_store_dir(&app);
    fs::create_dir_all(&store_dir).map_err(|e| e.to_string())?;

    let file_path = store_file_path(&store_dir, &key, "json")?;

    // Unique temp name per write (pid + sequence) avoids the race where two
    // concurrent PUTs share one `key.tmp` and the loser's rename hits ENOENT.
    validate_store_key(&key)?;
    let seq = TMP_SEQ.fetch_add(1, Ordering::Relaxed);
    let tmp_path = store_dir.join(format!("{key}.{}.{seq}.tmp", std::process::id()));

    // Write to temp file first, then atomically rename into place. On any
    // failure, remove the temp file so failed writes don't accumulate.
    if let Err(e) = fs::write(&tmp_path, data) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e.to_string());
    }
    fs::rename(&tmp_path, file_path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        e.to_string()
    })
}

pub fn remove_store_data<R: Runtime>(app: AppHandle<R>, key: String) -> Result<(), String> {
    let store_dir = get_store_dir(&app);
    let file_path = store_file_path(&store_dir, &key, "json")?;
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Config;

    fn app_with_cache_dir(cache_dir: &Path) -> tauri::App<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        app.manage(ConfigState(Mutex::new(Config {
            cache_dir: Some(cache_dir.to_string_lossy().into_owned()),
        })));
        app
    }

    #[test]
    fn validates_store_keys_as_single_safe_path_segments() {
        for key in ["library", "reader_state", "reader-state-1", "A1_b-2"] {
            assert!(validate_store_key(key).is_ok(), "{key} should be valid");
        }

        for key in [
            "",
            ".hidden",
            "../library",
            "library.json",
            "nested/path",
            "with space",
            "漫画",
        ] {
            assert!(validate_store_key(key).is_err(), "{key} should be invalid");
        }
    }

    #[test]
    fn store_file_path_appends_extension_inside_store_dir() {
        let store_dir = Path::new("/tmp/eriri-store");

        assert_eq!(
            store_file_path(store_dir, "reader-state", "json").expect("valid key"),
            store_dir.join("reader-state.json")
        );

        assert!(store_file_path(store_dir, "../escape", "json").is_err());
        assert!(store_file_path(store_dir, "nested/path", "json").is_err());
    }

    #[test]
    fn configured_cache_dir_is_used_only_when_it_exists() {
        let cache_dir = tempfile::tempdir().expect("create cache dir");
        let app = app_with_cache_dir(cache_dir.path());

        assert_eq!(
            get_configured_cache_dir(app.handle()),
            Some(cache_dir.path().to_path_buf())
        );
        assert_eq!(get_store_dir(app.handle()), cache_dir.path().join("store"));

        let missing_cache = cache_dir.path().join("missing");
        let missing_app = app_with_cache_dir(&missing_cache);
        assert_eq!(get_configured_cache_dir(missing_app.handle()), None);
    }

    #[test]
    fn store_data_round_trips_through_configured_cache_dir() {
        let cache_dir = tempfile::tempdir().expect("create cache dir");
        let app = app_with_cache_dir(cache_dir.path());
        let handle = app.handle().clone();

        assert_eq!(read_store_data(handle.clone(), "reader".into()), None);

        write_store_data(handle.clone(), "reader".into(), r#"{"page":42}"#.into())
            .expect("write store data");

        assert_eq!(
            read_store_data(handle.clone(), "reader".into()),
            Some(r#"{"page":42}"#.to_string())
        );
        assert_eq!(
            fs::read_to_string(cache_dir.path().join("store").join("reader.json"))
                .expect("read store file"),
            r#"{"page":42}"#
        );

        remove_store_data(handle.clone(), "reader".into()).expect("remove store data");
        assert_eq!(read_store_data(handle, "reader".into()), None);
    }

    #[test]
    fn invalid_store_keys_are_rejected_for_all_store_operations() {
        let cache_dir = tempfile::tempdir().expect("create cache dir");
        let app = app_with_cache_dir(cache_dir.path());
        let handle = app.handle().clone();

        assert_eq!(read_store_data(handle.clone(), "../escape".into()), None);
        assert!(write_store_data(handle.clone(), "../escape".into(), "data".into()).is_err());
        assert!(remove_store_data(handle, "../escape".into()).is_err());
        assert!(!cache_dir.path().join("escape.json").exists());
    }
}
