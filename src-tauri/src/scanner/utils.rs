use std::fs;
use std::path::Path;
use std::sync::LazyLock;
use std::time::SystemTime;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use tracing::info;
use uuid::Uuid;

pub const BOOK_EXTENSIONS: &[&str] = &["txt"];

const NAMESPACE_STR: &str = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
static NAMESPACE_UUID: LazyLock<Uuid> =
    LazyLock::new(|| Uuid::parse_str(NAMESPACE_STR).expect("Invalid namespace UUID constant"));

pub fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with('.'))
}

pub fn is_book_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext_str| {
            BOOK_EXTENSIONS
                .iter()
                .any(|&x| x.eq_ignore_ascii_case(ext_str))
        })
}

pub fn remove_extension(filename: &str) -> String {
    Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename)
        .to_string()
}

pub fn current_time_millis() -> u64 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

pub fn get_created_time(metadata: &fs::Metadata) -> u64 {
    metadata
        .created()
        .or_else(|_| metadata.modified())
        .map(|t| {
            t.duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
                .try_into()
                .unwrap_or(u64::MAX)
        })
        .unwrap_or_else(|_| current_time_millis())
}

pub fn generate_uuid(input: &str) -> String {
    Uuid::new_v5(&NAMESPACE_UUID, input.as_bytes()).to_string()
}

pub fn get_library_type(library_path: &str) -> Result<String, String> {
    let path = Path::new(library_path);
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let entry_path = entry.path();
        if is_hidden(&entry_path) {
            continue;
        }

        if entry_path.is_dir()
            && let Ok(sub_entries) = fs::read_dir(&entry_path)
        {
            for sub_entry in sub_entries.flatten() {
                let p = sub_entry.path();
                if is_hidden(&p) {
                    continue;
                }

                if is_book_file(&p) {
                    info!(path = %library_path, "Detected book library");
                    return Ok("book".to_string());
                }
                info!(path = %library_path, "Detected comic library");
                return Ok("comic".to_string());
            }
        }
    }

    info!(path = %library_path, "Defaulting to comic library");
    Ok("comic".to_string())
}

pub fn open_path_native(app: AppHandle, path: String) -> Result<(), String> {
    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Bring this menu-bar (accessory) app to the foreground so a native panel
/// opens in front of the browser instead of behind it. Must run on the main
/// thread. Unlike flipping the activation policy, this does not flash a Dock
/// icon — the app stays an accessory.
#[cfg(target_os = "macos")]
pub fn activate_foreground() {
    use objc2_app_kit::NSApplication;
    use objc2_foundation::MainThreadMarker;

    if let Some(mtm) = MainThreadMarker::new() {
        let ns_app = NSApplication::sharedApplication(mtm);
        #[allow(deprecated)]
        ns_app.activateIgnoringOtherApps(true);
    }
}

/// Open the native macOS folder picker and return the chosen absolute path.
pub async fn pick_directory_impl(app: &AppHandle) -> Option<String> {
    // Surface the app first so the panel appears in front (no Dock-icon flash).
    #[cfg(target_os = "macos")]
    let _ = app.run_on_main_thread(activate_foreground);

    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |path| {
        let _ = tx.send(path);
    });

    rx.await
        .ok()
        .flatten()
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_classifiers_match_reader_inputs() {
        assert!(is_hidden(Path::new(".DS_Store")));
        assert!(is_hidden(Path::new("/tmp/.hidden")));
        assert!(!is_hidden(Path::new("/tmp/visible")));

        assert!(is_book_file(Path::new("Book.TXT")));
        assert!(!is_book_file(Path::new("Book.md")));
        assert!(!is_book_file(Path::new("Book")));

        assert_eq!(remove_extension("Book.txt"), "Book");
        assert_eq!(remove_extension("Archive.tar.gz"), "Archive.tar");
        assert_eq!(remove_extension("NoExtension"), "NoExtension");
    }

    #[test]
    fn generated_ids_are_stable_and_input_sensitive() {
        assert_eq!(
            generate_uuid("/library/book"),
            generate_uuid("/library/book")
        );
        assert_ne!(
            generate_uuid("/library/book"),
            generate_uuid("/library/other")
        );
    }

    #[test]
    fn filesystem_timestamps_are_milliseconds_since_epoch() {
        let file = tempfile::NamedTempFile::new().expect("create temporary file");
        let metadata = file.as_file().metadata().expect("read file metadata");
        let before = current_time_millis();
        let created = get_created_time(&metadata);
        let after = current_time_millis();

        const MIN_REASONABLE_EPOCH_MILLIS: u64 = 1_000_000_000_000;
        const MAX_CLOCK_DRIFT_MILLIS: u64 = 60_000;

        assert!(before > MIN_REASONABLE_EPOCH_MILLIS);
        assert!(created > MIN_REASONABLE_EPOCH_MILLIS);
        assert!(created <= after);
        assert!(after.saturating_sub(created) < MAX_CLOCK_DRIFT_MILLIS);
        assert!(after >= before);
    }

    #[test]
    fn detects_book_libraries_from_nested_text_files() {
        let dir = tempfile::tempdir().expect("create library dir");
        let author = dir.path().join("Author");
        fs::create_dir(&author).expect("create author dir");
        fs::write(author.join(".hidden.txt"), "hidden").expect("write hidden file");
        fs::write(author.join("Book.txt"), "content").expect("write book");

        assert_eq!(
            get_library_type(dir.path().to_str().expect("path is utf-8")).expect("detect type"),
            "book"
        );
    }

    #[test]
    fn detects_comic_or_defaults_to_comic_for_non_book_libraries() {
        let comic_dir = tempfile::tempdir().expect("create comic library dir");
        let comic = comic_dir.path().join("Comic");
        fs::create_dir(&comic).expect("create comic dir");
        fs::write(comic.join("001.jpg"), "not decoded here").expect("write comic file");

        assert_eq!(
            get_library_type(comic_dir.path().to_str().expect("path is utf-8"))
                .expect("detect comic type"),
            "comic"
        );

        let empty_dir = tempfile::tempdir().expect("create empty library dir");
        assert_eq!(
            get_library_type(empty_dir.path().to_str().expect("path is utf-8"))
                .expect("default comic type"),
            "comic"
        );
    }

    #[test]
    fn reports_read_dir_errors_for_missing_libraries() {
        let missing = tempfile::tempdir()
            .expect("create temp dir")
            .path()
            .join("missing");

        assert!(get_library_type(missing.to_str().expect("path is utf-8")).is_err());
    }
}
