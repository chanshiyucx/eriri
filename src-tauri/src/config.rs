use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{AppHandle, Manager, Runtime};

use crate::models::Config;

pub struct ConfigState(pub Mutex<Config>);

pub(crate) fn validate_store_key(key: &str) -> Result<(), String> {
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

fn write_file_atomically(file_path: &Path, data: String) -> Result<(), String> {
    let parent = file_path
        .parent()
        .ok_or_else(|| "Failed to resolve file parent".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;

    let seq = TMP_SEQ.fetch_add(1, Ordering::Relaxed);
    let file_name = file_path
        .file_name()
        .ok_or_else(|| "Failed to resolve file name".to_string())?
        .to_string_lossy();
    let tmp_path = parent.join(format!(".{file_name}.{}.{seq}.tmp", std::process::id()));

    if let Err(e) = fs::write(&tmp_path, data) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e.to_string());
    }

    fs::rename(&tmp_path, file_path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        e.to_string()
    })
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
        let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        write_file_atomically(&config_path, content)?;

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

/// Monotonic counter giving each in-flight write its own temp file.
static TMP_SEQ: AtomicU64 = AtomicU64::new(0);

pub fn write_store_data<R: Runtime>(
    app: AppHandle<R>,
    key: String,
    data: String,
) -> Result<(), String> {
    let store_dir = get_store_dir(&app);
    let file_path = store_file_path(&store_dir, &key, "json")?;
    write_file_atomically(&file_path, data)
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

    static CONFIG_FILE_LOCK: std::sync::LazyLock<std::sync::Mutex<()>> =
        std::sync::LazyLock::new(|| std::sync::Mutex::new(()));

    fn app_with_cache_dir(cache_dir: &Path) -> tauri::App<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        app.manage(ConfigState(Mutex::new(Config {
            cache_dir: Some(cache_dir.to_string_lossy().into_owned()),
        })));
        app
    }

    fn app_with_config(config: Config) -> tauri::App<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        app.manage(ConfigState(Mutex::new(config)));
        app
    }

    fn reset_config_file(app: &AppHandle<tauri::test::MockRuntime>) -> PathBuf {
        let path = get_config_path(app).expect("resolve config path");
        let _ = fs::remove_file(&path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create config dir");
        }
        path
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
    fn get_loads_valid_disk_config_and_ignores_invalid_json() {
        let _guard = CONFIG_FILE_LOCK.lock().expect("lock config file");
        let cache_dir = tempfile::tempdir().expect("create cache dir");
        let app = tauri::test::mock_app();
        let config_path = reset_config_file(app.handle());

        fs::write(
            &config_path,
            serde_json::json!({ "cache_dir": cache_dir.path() }).to_string(),
        )
        .expect("write config file");

        assert_eq!(
            get(app.handle()).cache_dir,
            Some(cache_dir.path().to_string_lossy().into_owned())
        );

        fs::write(&config_path, "{ invalid json").expect("write invalid config file");
        assert_eq!(get(app.handle()).cache_dir, None);

        let _ = fs::remove_file(config_path);
    }

    #[test]
    fn init_loads_disk_config_into_managed_state() {
        let _guard = CONFIG_FILE_LOCK.lock().expect("lock config file");
        let cache_dir = tempfile::tempdir().expect("create cache dir");
        let mut app = tauri::test::mock_app();
        let config_path = reset_config_file(app.handle());
        fs::write(
            &config_path,
            serde_json::json!({ "cache_dir": cache_dir.path() }).to_string(),
        )
        .expect("write config file");

        init(&mut app).expect("init config state");

        assert_eq!(
            get(app.handle()).cache_dir,
            Some(cache_dir.path().to_string_lossy().into_owned())
        );

        fs::write(&config_path, "{}").expect("overwrite config file");
        assert_eq!(
            get(app.handle()).cache_dir,
            Some(cache_dir.path().to_string_lossy().into_owned())
        );

        let _ = fs::remove_file(config_path);
    }

    #[test]
    fn save_config_writes_to_disk_and_updates_managed_state() {
        let _guard = CONFIG_FILE_LOCK.lock().expect("lock config file");
        let cache_dir = tempfile::tempdir().expect("create cache dir");
        let app = app_with_config(Config::default());
        let config_path = reset_config_file(app.handle());
        let config = Config {
            cache_dir: Some(cache_dir.path().to_string_lossy().into_owned()),
        };

        save_config(app.handle(), &config).expect("save config");

        assert_eq!(get(app.handle()).cache_dir, config.cache_dir);
        assert_eq!(
            serde_json::from_str::<Config>(
                &fs::read_to_string(&config_path).expect("read config file")
            )
            .expect("parse config")
            .cache_dir,
            Some(cache_dir.path().to_string_lossy().into_owned())
        );

        let _ = fs::remove_file(config_path);
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
