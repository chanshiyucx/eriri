//! macOS Security-Scoped Bookmarks for persistent file access permissions.
//!
//! Uses `objc2` bindings to macOS Foundation framework to create and resolve
//! security-scoped bookmarks directly in the main process.

use base64::{engine::general_purpose::STANDARD, Engine};
use objc2::runtime::Bool;
use objc2_foundation::{
    NSData, NSString, NSURLBookmarkCreationOptions, NSURLBookmarkResolutionOptions, NSURL,
};
use tauri::{AppHandle, Runtime};

const BOOKMARK_CREATION_WITH_SECURITY_SCOPE: NSURLBookmarkCreationOptions =
    NSURLBookmarkCreationOptions(1 << 11);
const BOOKMARK_RESOLUTION_WITH_SECURITY_SCOPE: NSURLBookmarkResolutionOptions =
    NSURLBookmarkResolutionOptions(1 << 10);

fn create_bookmark_impl(path: &str) -> Result<String, String> {
    let path_ns = NSString::from_str(path);
    let url = unsafe { NSURL::fileURLWithPath(&path_ns) };

    let bookmark_data = unsafe {
        url.bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
            BOOKMARK_CREATION_WITH_SECURITY_SCOPE,
            None,
            None,
        )
    }
    .map_err(|e| format!("Failed to create bookmark: {e}"))?;

    Ok(STANDARD.encode(bookmark_data.bytes()))
}

fn resolve_bookmark_impl(bookmark_base64: &str) -> Result<String, String> {
    let bookmark_bytes = STANDARD
        .decode(bookmark_base64)
        .map_err(|e| format!("Invalid base64 data: {e}"))?;

    let bookmark_data = NSData::with_bytes(&bookmark_bytes);
    let mut is_stale = Bool::NO;

    let url = unsafe {
        NSURL::URLByResolvingBookmarkData_options_relativeToURL_bookmarkDataIsStale_error(
            &bookmark_data,
            BOOKMARK_RESOLUTION_WITH_SECURITY_SCOPE,
            None,
            &mut is_stale,
        )
    }
    .map_err(|e| format!("Failed to resolve bookmark: {e}"))?;

    if !unsafe { url.startAccessingSecurityScopedResource() } {
        return Err("Failed to start accessing security-scoped resource".to_string());
    }

    unsafe { url.path() }
        .map(|p| p.to_string())
        .ok_or_else(|| "Failed to get path from URL".to_string())
}

#[tauri::command]
pub fn create_bookmark<R: Runtime>(_app: AppHandle<R>, path: String) -> Result<String, String> {
    create_bookmark_impl(&path)
}

#[tauri::command]
pub fn resolve_bookmark<R: Runtime>(
    _app: AppHandle<R>,
    bookmark_data: String,
) -> Result<String, String> {
    resolve_bookmark_impl(&bookmark_data)
}

#[tauri::command]
pub fn restore_bookmarks<R: Runtime>(
    _app: AppHandle<R>,
    bookmarks: Vec<String>,
) -> Vec<Result<String, String>> {
    bookmarks
        .into_iter()
        .map(|data| resolve_bookmark_impl(&data))
        .collect()
}
