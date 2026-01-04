use once_cell::sync::Lazy;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::SystemTime;
use tracing::info;
use uuid::Uuid;

// File extension constants
pub const VIDEO_EXTENSIONS: &[&str] = &["mp4"];
pub const BOOK_EXTENSIONS: &[&str] = &["txt"];

// UUID namespace for deterministic ID generation (lazy initialized)
const NAMESPACE_STR: &str = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
static NAMESPACE_UUID: Lazy<Uuid> =
    Lazy::new(|| Uuid::parse_str(NAMESPACE_STR).expect("Invalid namespace UUID constant"));

/// Check if file/directory is hidden (starts with dot)
pub fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.starts_with('.'))
        .unwrap_or(false)
}

/// Check if path is a book file
pub fn is_book_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext_str| BOOK_EXTENSIONS.iter().any(|&x| x.eq_ignore_ascii_case(ext_str)))
}

/// Check if path is a video file
pub fn is_video_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext_str| VIDEO_EXTENSIONS.iter().any(|&x| x.eq_ignore_ascii_case(ext_str)))
}

/// Remove file extension from filename
pub fn remove_extension(filename: &str) -> String {
    Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename)
        .to_string()
}

/// Get current time in milliseconds since epoch
pub fn current_time_millis() -> u64 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

/// Get file creation time in milliseconds since epoch
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

/// Generate deterministic UUID from input string
pub fn generate_uuid(input: &str) -> String {
    Uuid::new_v5(&NAMESPACE_UUID, input.as_bytes()).to_string()
}

/// Tauri command wrapper for generate_uuid
#[tauri::command]
pub fn generate_uuid_command(input: &str) -> String {
    generate_uuid(input)
}

/// Detect library type by scanning directory contents
#[tauri::command]
pub fn get_library_type(library_path: &str) -> Result<String, String> {
    let path = Path::new(library_path);
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let entry_path = entry.path();
        if is_hidden(&entry_path) {
            continue;
        }

        if entry_path.is_file() && is_video_file(&entry_path) {
            info!(path = %library_path, "Detected video library");
            return Ok("video".to_string());
        }

        if entry_path.is_dir() {
            if let Ok(sub_entries) = fs::read_dir(&entry_path) {
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
    }

    info!(path = %library_path, "Defaulting to comic library");
    Ok("comic".to_string())
}

/// Open a file or directory in the system's default file manager
#[tauri::command]
pub fn open_path_native(path: String) -> Result<(), String> {
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}
