//! macOS Security-Scoped Bookmarks for persistent file access permissions.
//!
//! This module uses direct FFI calls to macOS Foundation framework to create
//! and resolve security-scoped bookmarks in the main process.

#[cfg(target_os = "macos")]
#[allow(deprecated)] // cocoa crate suggests migration to objc2, but that's a larger change
mod macos {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSString;
    use objc::runtime::{BOOL, NO};
    use objc::{class, msg_send, sel, sel_impl};
    use std::ffi::CStr;

    // NSURLBookmarkCreationWithSecurityScope = 1 << 11 = 2048
    const NS_URL_BOOKMARK_CREATION_WITH_SECURITY_SCOPE: usize = 1 << 11;

    // NSURLBookmarkResolutionWithSecurityScope = 1 << 10 = 1024
    const NS_URL_BOOKMARK_RESOLUTION_WITH_SECURITY_SCOPE: usize = 1 << 10;

    pub fn create_bookmark(path: &str) -> Result<String, String> {
        unsafe {
            let path_nsstring = NSString::alloc(nil).init_str(path);
            let url: id = msg_send![class!(NSURL), fileURLWithPath: path_nsstring];

            if url == nil {
                return Err("Failed to create NSURL from path".to_string());
            }

            let mut error: id = nil;
            let bookmark_data: id = msg_send![url,
                bookmarkDataWithOptions: NS_URL_BOOKMARK_CREATION_WITH_SECURITY_SCOPE
                includingResourceValuesForKeys: nil
                relativeToURL: nil
                error: &mut error
            ];

            if bookmark_data == nil || error != nil {
                let error_desc = if error != nil {
                    let desc: id = msg_send![error, localizedDescription];
                    nsstring_to_string(desc)
                } else {
                    "Unknown error".to_string()
                };
                return Err(format!("Failed to create bookmark: {}", error_desc));
            }

            let length: usize = msg_send![bookmark_data, length];
            let bytes: *const u8 = msg_send![bookmark_data, bytes];
            let slice = std::slice::from_raw_parts(bytes, length);
            Ok(STANDARD.encode(slice))
        }
    }

    pub fn resolve_bookmark(bookmark_base64: &str) -> Result<String, String> {
        let bookmark_bytes = STANDARD
            .decode(bookmark_base64)
            .map_err(|e| format!("Invalid base64 data: {}", e))?;

        unsafe {
            let bookmark_data: id = msg_send![class!(NSData),
                dataWithBytes: bookmark_bytes.as_ptr()
                length: bookmark_bytes.len()
            ];

            if bookmark_data == nil {
                return Err("Failed to create NSData from bookmark".to_string());
            }

            let mut is_stale: BOOL = NO;
            let mut error: id = nil;
            let url: id = msg_send![class!(NSURL),
                URLByResolvingBookmarkData: bookmark_data
                options: NS_URL_BOOKMARK_RESOLUTION_WITH_SECURITY_SCOPE
                relativeToURL: nil
                bookmarkDataIsStale: &mut is_stale
                error: &mut error
            ];

            if url == nil || error != nil {
                let error_desc = if error != nil {
                    let desc: id = msg_send![error, localizedDescription];
                    nsstring_to_string(desc)
                } else {
                    "Unknown error".to_string()
                };
                return Err(format!("Failed to resolve bookmark: {}", error_desc));
            }

            // Start accessing the security-scoped resource in THIS process
            let started: BOOL = msg_send![url, startAccessingSecurityScopedResource];
            if started == NO {
                return Err("Failed to start accessing security-scoped resource".to_string());
            }

            let path: id = msg_send![url, path];
            Ok(nsstring_to_string(path))
        }
    }

    unsafe fn nsstring_to_string(nsstring: id) -> String {
        if nsstring == nil {
            return String::new();
        }
        let c_str: *const i8 = msg_send![nsstring, UTF8String];
        if c_str.is_null() {
            return String::new();
        }
        CStr::from_ptr(c_str).to_string_lossy().into_owned()
    }
}

#[cfg(not(target_os = "macos"))]
mod macos {
    pub fn create_bookmark(_path: &str) -> Result<String, String> {
        Err("Security-scoped bookmarks are only supported on macOS".to_string())
    }

    pub fn resolve_bookmark(_bookmark_base64: &str) -> Result<String, String> {
        Err("Security-scoped bookmarks are only supported on macOS".to_string())
    }
}

use tauri::{AppHandle, Runtime};

#[tauri::command]
pub fn create_bookmark<R: Runtime>(_app: AppHandle<R>, path: String) -> Result<String, String> {
    macos::create_bookmark(&path)
}

#[tauri::command]
pub fn resolve_bookmark<R: Runtime>(
    _app: AppHandle<R>,
    bookmark_data: String,
) -> Result<String, String> {
    macos::resolve_bookmark(&bookmark_data)
}

#[tauri::command]
pub fn restore_bookmarks<R: Runtime>(
    _app: AppHandle<R>,
    bookmarks: Vec<String>,
) -> Vec<Result<String, String>> {
    bookmarks
        .into_iter()
        .map(|data| macos::resolve_bookmark(&data))
        .collect()
}
