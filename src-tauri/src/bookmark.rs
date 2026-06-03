//! macOS Security-Scoped Bookmarks for persistent file access permissions.
//!
//! Uses `objc2` bindings to macOS Foundation framework to create and resolve
//! security-scoped bookmarks directly in the main process.

use base64::{Engine, engine::general_purpose::STANDARD};
use objc2::runtime::Bool;
use objc2_foundation::{
    NSData, NSString, NSURL, NSURLBookmarkCreationOptions, NSURLBookmarkResolutionOptions,
};
use std::path::Path;
use tauri::{AppHandle, Manager, Runtime};

const BOOKMARK_CREATION_WITH_SECURITY_SCOPE: NSURLBookmarkCreationOptions =
    NSURLBookmarkCreationOptions(1 << 11);
const BOOKMARK_RESOLUTION_WITH_SECURITY_SCOPE: NSURLBookmarkResolutionOptions =
    NSURLBookmarkResolutionOptions(1 << 10);

fn create_bookmark_impl(path: &str) -> Result<String, String> {
    let path_ns = NSString::from_str(path);
    let url = NSURL::fileURLWithPath(&path_ns);

    let bookmark_data = url
        .bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
            BOOKMARK_CREATION_WITH_SECURITY_SCOPE,
            None,
            None,
        )
        .map_err(|e| format!("Failed to create bookmark: {e}"))?;

    Ok(STANDARD.encode(bookmark_data.to_vec()))
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

    url.path()
        .map(|p| p.to_string())
        .ok_or_else(|| "Failed to get path from URL".to_string())
}

fn allow_asset_directory<R: Runtime>(app: &AppHandle<R>, path: &str) {
    let path = Path::new(path);
    if path.is_dir() {
        let _ = app.asset_protocol_scope().allow_directory(path, true);
    }
}

#[tauri::command]
pub fn create_bookmark<R: Runtime>(app: AppHandle<R>, path: String) -> Result<String, String> {
    allow_asset_directory(&app, &path);
    create_bookmark_impl(&path)
}

#[tauri::command]
pub fn resolve_bookmark<R: Runtime>(
    app: AppHandle<R>,
    bookmark_data: String,
) -> Result<String, String> {
    let path = resolve_bookmark_impl(&bookmark_data)?;
    allow_asset_directory(&app, &path);
    Ok(path)
}

#[tauri::command]
pub fn restore_bookmarks<R: Runtime>(
    app: AppHandle<R>,
    bookmarks: Vec<String>,
) -> Vec<Result<String, String>> {
    bookmarks
        .into_iter()
        .map(|data| {
            let path = resolve_bookmark_impl(&data)?;
            allow_asset_directory(&app, &path);
            Ok(path)
        })
        .collect()
}
