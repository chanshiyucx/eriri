//! Embedded LAN HTTP server — the app's only client interface.
//!
//! Runs inside the Tauri process, sharing its `AppHandle`, cache dir, store and
//! Rust scanning logic. Serves the built frontend and the API to any browser on
//! the Wi-Fi at `http://<mac-lan-ip>:1430`. CPU-heavy scans run on the blocking
//! pool so they don't stall the executor.

use std::net::{IpAddr, SocketAddr, UdpSocket};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::RwLock;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use axum::Json;
use axum::Router;
use axum::extract::{ConnectInfo, Path as AxumPath, Query, Request, State};
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use serde::Deserialize;
use tauri::{AppHandle, Manager, Runtime};
use tower::ServiceExt;
use tower_http::compression::CompressionLayer;
use tower_http::services::{ServeDir, ServeFile};
use tracing::{error, info, warn};

use crate::config;
use crate::library::{self, Catalog};
use crate::models::{ComicImage, FileTags};
use crate::progress::{self, BookProgress, ComicProgress, ProgressDb, Snapshot};

const PORT: u16 = 1430;

/// Release the keep-awake assertion after this many seconds without any HTTP
/// request, letting the Mac sleep normally. Once asleep the server is down and
/// a LAN client can no longer reach it — the Mac must be woken manually, after
/// which the next request re-arms the assertion.
const IDLE_SLEEP_TIMEOUT_SECS: u64 = 2 * 60 * 60;

// Built frontend, resolved relative to this crate (requires `pnpm build`).
// A bundled .app would instead embed these assets.
const DIST_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../dist");

pub fn init(app: &AppHandle) {
    let activity = Activity::new();
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let router = build_router(handle, activity.clone());
        match tokio::net::TcpListener::bind(("0.0.0.0", PORT)).await {
            Ok(listener) => {
                let lan = lan_ip()
                    .map(|ip| format!("http://{ip}:{PORT}"))
                    .unwrap_or_else(|| format!("http://<mac-lan-ip>:{PORT}"));
                info!(url = %lan, "LAN web server listening");
                // Only keep the Mac awake once the port is actually bound: a
                // failed bind means there's no server to stay reachable for.
                spawn_idle_sleep_manager(activity);
                // The port is bound; open the reader in the browser on startup.
                open_in_browser();
                let service = router.into_make_service_with_connect_info::<SocketAddr>();
                if let Err(e) = axum::serve(listener, service).await {
                    error!(error = %e, "Web server stopped");
                }
            }
            Err(e) => error!(error = %e, port = PORT, "Failed to bind web server"),
        }
    });
}

fn build_router(app: AppHandle, activity: Activity) -> Router {
    let index = format!("{DIST_DIR}/index.html");
    let static_files = ServeDir::new(DIST_DIR).not_found_service(ServeFile::new(index));

    Router::new()
        .route("/api/scan-comic-images", get(scan_comic_images))
        .route("/api/parse-book", get(parse_book))
        .route("/api/tag", post(set_tag))
        .route(
            "/api/store/{key}",
            get(store_get).put(store_put).delete(store_delete),
        )
        .route("/api/libraries", get(get_catalog))
        .route(
            "/api/libraries/order",
            axum::routing::put(reorder_libraries),
        )
        .route("/api/library/{id}/refresh", post(refresh_library))
        .route("/api/library/{id}", axum::routing::delete(remove_library))
        .route("/api/comic/{id}/tags", post(set_comic_tags))
        .route("/api/book/{id}/tags", post(set_book_tags))
        .route("/api/reveal", post(reveal_path))
        .route("/api/progress", get(get_progress))
        .route(
            "/api/progress/comic/{id}",
            axum::routing::put(put_comic_progress).delete(delete_comic_progress),
        )
        .route(
            "/api/progress/book/{id}",
            axum::routing::put(put_book_progress).delete(delete_book_progress),
        )
        .route(
            "/api/progress/book/{id}/favorites",
            axum::routing::put(put_book_favorites).delete(delete_book_favorites),
        )
        .route("/file", get(serve_file))
        .fallback_service(static_files)
        // Stamp every request as activity so the idle-sleep manager keeps the
        // Mac awake while clients are using it, and lets it sleep once they stop.
        .layer(axum::middleware::from_fn_with_state(
            activity,
            track_activity,
        ))
        .layer(axum::middleware::from_fn(no_store_dynamic))
        // Gzip large text/JSON (e.g. parsed books) — compresses ~5-10x, the
        // dominant cost when loading over the LAN. Loopback opts out below.
        .layer(CompressionLayer::new())
        .layer(axum::middleware::from_fn(skip_compression_on_loopback))
        .with_state(app)
}

/// Strip Accept-Encoding for loopback clients so the CompressionLayer above
/// sends raw bytes: on localhost transfer is free, so gzip is pure CPU overhead
/// (compress + decompress) that makes large books slower. LAN clients keep it.
async fn skip_compression_on_loopback(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    mut req: Request,
    next: axum::middleware::Next,
) -> Response {
    if addr.ip().is_loopback() {
        req.headers_mut().remove(header::ACCEPT_ENCODING);
    }
    next.run(req).await
}

/// The catalog/progress API and the HTML app shell must never be cached by a
/// client, so every refresh or startup reflects the backend's latest state.
/// Hashed JS/CSS assets stay cacheable (their URL changes on each build).
async fn no_store_dynamic(req: Request, next: axum::middleware::Next) -> Response {
    let is_api = req.uri().path().starts_with("/api");
    let mut res = next.run(req).await;
    let is_html = res
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.starts_with("text/html"));
    if is_api || is_html {
        res.headers_mut().insert(
            header::CACHE_CONTROL,
            axum::http::HeaderValue::from_static("no-store"),
        );
    }
    res
}

// --- Error helper ---

struct ApiError(String);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (StatusCode::INTERNAL_SERVER_ERROR, self.0).into_response()
    }
}

// --- Query/body shapes ---

#[derive(Deserialize)]
struct PathQuery {
    path: String,
}

#[derive(Deserialize)]
struct TagBody {
    path: String,
    starred: Option<bool>,
    deleted: Option<bool>,
}

// --- API handlers ---

async fn scan_comic_images(
    State(app): State<AppHandle>,
    Query(q): Query<PathQuery>,
) -> Result<Json<Vec<ComicImage>>, ApiError> {
    blocking(move || crate::scanner::comic::scan_comic_images(app, &q.path))
        .await?
        .map(Json)
        .map_err(ApiError)
}

async fn parse_book(Query(q): Query<PathQuery>) -> Result<Response, ApiError> {
    let content = blocking(move || crate::scanner::book::parse_book(&q.path))
        .await?
        .map_err(ApiError)?;

    // Serialize manually to advertise the uncompressed length: gzip drops
    // Content-Length, so the client tracks download progress against this header.
    let body = serde_json::to_vec(&content).map_err(|e| ApiError(e.to_string()))?;
    let len = body.len();

    let mut res = Response::new(axum::body::Body::from(body));
    let headers = res.headers_mut();
    headers.insert(
        header::CONTENT_TYPE,
        axum::http::HeaderValue::from_static("application/json"),
    );
    headers.insert("x-uncompressed-length", axum::http::HeaderValue::from(len));
    Ok(res)
}

async fn set_tag(Json(b): Json<TagBody>) -> Result<StatusCode, ApiError> {
    blocking(move || {
        let tags = FileTags {
            starred: b.starred,
            deleted: b.deleted,
        };
        crate::tags::set_file_tag(b.path, tags)
    })
    .await?
    .map(|()| StatusCode::NO_CONTENT)
    .map_err(ApiError)
}

fn remove_library_impl(app: &AppHandle, id: &str) -> Result<(), String> {
    let state = app.state::<library::LibraryDb>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    library::remove(&conn, id).map_err(|e| e.to_string())
}

fn reorder_libraries_impl(app: &AppHandle, ordered_ids: &[String]) -> Result<(), String> {
    let state = app.state::<library::LibraryDb>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    library::reorder(&conn, ordered_ids).map_err(|e| e.to_string())
}

fn with_progress<T>(
    app: &AppHandle,
    f: impl FnOnce(&rusqlite::Connection) -> rusqlite::Result<T>,
) -> Result<T, String> {
    let state = app.state::<ProgressDb>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    f(&conn).map_err(|e| e.to_string())
}

fn no_content(result: Result<(), String>) -> Result<StatusCode, ApiError> {
    result.map(|()| StatusCode::NO_CONTENT).map_err(ApiError)
}

// --- Server store: the single owner of each persisted zustand blob ---

async fn store_get<R: Runtime>(
    State(app): State<AppHandle<R>>,
    AxumPath(key): AxumPath<String>,
) -> Response {
    if let Err(e) = config::validate_store_key(&key) {
        return (StatusCode::BAD_REQUEST, e).into_response();
    }

    match config::read_store_data(app, key) {
        Some(data) => ([(header::CONTENT_TYPE, "application/json")], data).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn store_put<R: Runtime>(
    State(app): State<AppHandle<R>>,
    AxumPath(key): AxumPath<String>,
    body: String,
) -> Response {
    if let Err(e) = config::validate_store_key(&key) {
        return (StatusCode::BAD_REQUEST, e).into_response();
    }

    match config::write_store_data(app, key, body) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => ApiError(e).into_response(),
    }
}

async fn store_delete<R: Runtime>(
    State(app): State<AppHandle<R>>,
    AxumPath(key): AxumPath<String>,
) -> Response {
    if let Err(e) = config::validate_store_key(&key) {
        return (StatusCode::BAD_REQUEST, e).into_response();
    }

    match config::remove_store_data(app, key) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => ApiError(e).into_response(),
    }
}

#[derive(Deserialize)]
struct RevealBody {
    path: String,
}

async fn reveal_path(
    State(app): State<AppHandle>,
    Json(body): Json<RevealBody>,
) -> Result<StatusCode, ApiError> {
    crate::scanner::utils::open_path_native(app, body.path)
        .map(|()| StatusCode::NO_CONTENT)
        .map_err(ApiError)
}

// --- Library catalog (single source of truth) ---

async fn get_catalog(State(app): State<AppHandle>) -> Result<Json<Catalog>, ApiError> {
    blocking(move || {
        let state = app.state::<library::LibraryDb>();
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        library::get_catalog(&conn).map_err(|e| e.to_string())
    })
    .await?
    .map(Json)
    .map_err(ApiError)
}

async fn refresh_library(
    State(app): State<AppHandle>,
    AxumPath(id): AxumPath<String>,
) -> Result<StatusCode, ApiError> {
    blocking(move || library::refresh(&app, &id))
        .await?
        .map(|()| StatusCode::NO_CONTENT)
        .map_err(ApiError)
}

async fn remove_library(
    State(app): State<AppHandle>,
    AxumPath(id): AxumPath<String>,
) -> Result<StatusCode, ApiError> {
    let roots_app = app.clone();
    blocking(move || remove_library_impl(&app, &id))
        .await?
        .map_err(ApiError)?;
    rebuild_allowed_roots(&roots_app);
    Ok(StatusCode::NO_CONTENT)
}

async fn reorder_libraries(
    State(app): State<AppHandle>,
    Json(ordered_ids): Json<Vec<String>>,
) -> Result<StatusCode, ApiError> {
    no_content(blocking(move || reorder_libraries_impl(&app, &ordered_ids)).await?)
}

async fn set_comic_tags(
    State(app): State<AppHandle>,
    AxumPath(id): AxumPath<String>,
    Json(tags): Json<FileTags>,
) -> Result<StatusCode, ApiError> {
    no_content(blocking(move || library::set_comic_tags(&app, &id, &tags)).await?)
}

async fn set_book_tags(
    State(app): State<AppHandle>,
    AxumPath(id): AxumPath<String>,
    Json(tags): Json<FileTags>,
) -> Result<StatusCode, ApiError> {
    no_content(blocking(move || library::set_book_tags(&app, &id, &tags)).await?)
}

// --- Reading progress (single source of truth, field-level) ---

async fn get_progress(State(app): State<AppHandle>) -> Result<Json<Snapshot>, ApiError> {
    blocking(move || with_progress(&app, progress::get_snapshot))
        .await?
        .map(Json)
        .map_err(ApiError)
}

async fn put_comic_progress(
    State(app): State<AppHandle>,
    AxumPath(id): AxumPath<String>,
    Json(p): Json<ComicProgress>,
) -> Result<StatusCode, ApiError> {
    no_content(blocking(move || with_progress(&app, |c| progress::upsert_comic(c, &id, &p))).await?)
}

async fn delete_comic_progress(
    State(app): State<AppHandle>,
    AxumPath(id): AxumPath<String>,
) -> Result<StatusCode, ApiError> {
    no_content(blocking(move || with_progress(&app, |c| progress::delete_comic(c, &id))).await?)
}

async fn put_book_progress(
    State(app): State<AppHandle>,
    AxumPath(id): AxumPath<String>,
    Json(p): Json<BookProgress>,
) -> Result<StatusCode, ApiError> {
    no_content(blocking(move || with_progress(&app, |c| progress::upsert_book(c, &id, &p))).await?)
}

async fn delete_book_progress(
    State(app): State<AppHandle>,
    AxumPath(id): AxumPath<String>,
) -> Result<StatusCode, ApiError> {
    no_content(blocking(move || with_progress(&app, |c| progress::delete_book(c, &id))).await?)
}

async fn put_book_favorites(
    State(app): State<AppHandle>,
    AxumPath(id): AxumPath<String>,
    Json(lines): Json<Vec<i64>>,
) -> Result<StatusCode, ApiError> {
    no_content(
        blocking(move || with_progress(&app, |c| progress::set_favorites(c, &id, &lines))).await?,
    )
}

async fn delete_book_favorites(
    State(app): State<AppHandle>,
    AxumPath(id): AxumPath<String>,
) -> Result<StatusCode, ApiError> {
    no_content(blocking(move || with_progress(&app, |c| progress::delete_favorites(c, &id))).await?)
}

// --- File streaming (covers, thumbnails, full-size images) ---

async fn serve_file(
    State(app): State<AppHandle>,
    Query(q): Query<PathQuery>,
    req: Request,
) -> Response {
    let path = PathBuf::from(&q.path);
    let Ok(canon) = path.canonicalize() else {
        return (StatusCode::FORBIDDEN, "forbidden").into_response();
    };
    let roots = app.state::<AllowedRoots>();
    let Some(is_thumbnail) = roots.classify(&canon) else {
        return (StatusCode::FORBIDDEN, "forbidden").into_response();
    };

    // ServeFile handles Range, Content-Type and conditional requests.
    match ServeFile::new(&canon).oneshot(req).await {
        Ok(res) => {
            let mut res = res.map(axum::body::Body::new);
            if is_thumbnail {
                res.headers_mut().insert(
                    header::CACHE_CONTROL,
                    axum::http::HeaderValue::from_static("public, max-age=31536000, immutable"),
                );
            }
            res
        }
        Err(e) => {
            warn!(error = %e, path = %canon.display(), "Failed to serve file");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// --- File allowlist ---

struct AllowedRoots(RwLock<RootsSnapshot>);

#[derive(Default)]
struct RootsSnapshot {
    thumb_dir: Option<PathBuf>,
    roots: Vec<PathBuf>,
}

impl AllowedRoots {
    fn classify(&self, canon: &Path) -> Option<bool> {
        let Ok(s) = self.0.read() else {
            return None;
        };
        if !s.roots.iter().any(|root| canon.starts_with(root)) {
            return None;
        }
        Some(s.thumb_dir.as_ref().is_some_and(|t| canon.starts_with(t)))
    }
}

pub(crate) fn init_allowed_roots(app: &AppHandle) {
    app.manage(AllowedRoots(RwLock::new(RootsSnapshot::default())));
    rebuild_allowed_roots(app);
}

pub(crate) fn rebuild_allowed_roots(app: &AppHandle) {
    let thumb_dir = crate::thumbnail::get_thumbnail_dir(app).canonicalize().ok();

    let mut roots: Vec<PathBuf> = thumb_dir
        .as_ref()
        .into_iter()
        .cloned()
        .chain(
            library_roots(app)
                .into_iter()
                .filter_map(|root| Path::new(&root).canonicalize().ok()),
        )
        .collect();
    roots.sort_unstable();
    roots.dedup();

    let snapshot = RootsSnapshot { thumb_dir, roots };
    if let Some(state) = app.try_state::<AllowedRoots>()
        && let Ok(mut w) = state.0.write()
    {
        *w = snapshot;
    }
}

fn library_roots(app: &AppHandle) -> Vec<String> {
    // The catalog lives in SQLite now; read imported library paths from there.
    crate::library::list_for_menu(app)
        .into_iter()
        .map(|(_, _, path)| path)
        .collect()
}

// --- Idle-aware keep-awake ---

/// Wall-clock seconds since the Unix epoch (saturating to 0 on the impossible
/// pre-epoch case), used to measure how long the server has been idle.
fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Shared "last request seen" timestamp. Cloneable handle over one atomic, so
/// the request middleware and the keep-awake manager observe the same value.
#[derive(Clone)]
struct Activity(Arc<AtomicU64>);

impl Activity {
    /// Start the idle window now, so a freshly launched server stays awake for
    /// a full timeout even before the first client connects.
    fn new() -> Self {
        Activity(Arc::new(AtomicU64::new(now_secs())))
    }

    fn touch(&self) {
        self.0.store(now_secs(), Ordering::Relaxed);
    }

    fn idle_secs(&self) -> u64 {
        now_secs().saturating_sub(self.0.load(Ordering::Relaxed))
    }
}

/// Mark the arrival of any HTTP request as activity.
async fn track_activity(
    State(activity): State<Activity>,
    req: Request,
    next: axum::middleware::Next,
) -> Response {
    activity.touch();
    next.run(req).await
}

// macOS display/session state. Used to anchor the idle window to the moment the
// user leaves: while the screen is on and unlocked the Mac is in use (and won't
// idle-sleep anyway), so we treat it as continuously active; the countdown only
// begins once the display sleeps or the session locks.
#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGMainDisplayID() -> u32;
    fn CGDisplayIsAsleep(display: u32) -> i32;
    fn CGSessionCopyCurrentDictionary() -> *const std::ffi::c_void;
}

#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CFRelease(cf: *const std::ffi::c_void);
    fn CFDictionaryGetValue(
        dict: *const std::ffi::c_void,
        key: *const std::ffi::c_void,
    ) -> *const std::ffi::c_void;
    fn CFBooleanGetValue(boolean: *const std::ffi::c_void) -> u8;
    fn CFStringCreateWithCString(
        alloc: *const std::ffi::c_void,
        c_str: *const std::ffi::c_char,
        encoding: u32,
    ) -> *const std::ffi::c_void;
}

/// True while someone is at the Mac — the main display is awake and the session
/// is unlocked. Returns false once the screen turns off or locks, which is when
/// the idle-sleep countdown should start.
fn user_is_present() -> bool {
    !display_asleep() && !session_locked()
}

fn display_asleep() -> bool {
    // Safety: a plain CoreGraphics query, callable from any thread.
    unsafe { CGDisplayIsAsleep(CGMainDisplayID()) != 0 }
}

fn session_locked() -> bool {
    const UTF8: u32 = 0x0800_0100; // kCFStringEncodingUTF8
    // Safety: we own the copied dictionary and the created key, and release both
    // before returning; every borrowed value is checked for null first.
    unsafe {
        let dict = CGSessionCopyCurrentDictionary();
        if dict.is_null() {
            return false;
        }
        let key =
            CFStringCreateWithCString(std::ptr::null(), c"CGSSessionScreenIsLocked".as_ptr(), UTF8);
        let mut locked = false;
        if !key.is_null() {
            let value = CFDictionaryGetValue(dict, key);
            if !value.is_null() {
                locked = CFBooleanGetValue(value) != 0;
            }
            CFRelease(key);
        }
        CFRelease(dict);
        locked
    }
}

/// Keep the Mac reachable while clients are using the server, and let it sleep
/// once they stop.
///
/// macOS normally follows display-off with system (idle) sleep, which suspends
/// this process — the axum server stops responding and LAN connections drop.
/// While requests are recent we hold a `caffeinate -i` "prevent idle system
/// sleep" assertion (the display still sleeps, so the screen turns off as
/// usual). After `IDLE_SLEEP_TIMEOUT_SECS` with no request we drop it, so the
/// Mac sleeps normally to save power. `-w <pid>` ties the helper to our process
/// so it never outlives the app; `-s` also blocks forced sleep, but only on AC.
///
/// The countdown is anchored to the moment the user leaves: while the screen is
/// on and unlocked we refresh the activity stamp every tick, so the timer only
/// starts running once the display sleeps or the session locks. A LAN request
/// after that still extends the window like any other access.
fn spawn_idle_sleep_manager(activity: Activity) {
    tauri::async_runtime::spawn(async move {
        let pid = std::process::id().to_string();
        let mut guard: Option<std::process::Child> = None;
        loop {
            if user_is_present() {
                activity.touch();
            }
            // Reap a caffeinate that died on its own (killed externally, crashed)
            // so the next active tick re-arms the assertion instead of assuming
            // the long-gone child still holds it.
            if let Some(child) = guard.as_mut()
                && matches!(child.try_wait(), Ok(Some(_)) | Err(_))
            {
                warn!("caffeinate exited unexpectedly; will re-arm if still active");
                guard = None;
            }
            let idle = activity.idle_secs();
            if idle < IDLE_SLEEP_TIMEOUT_SECS {
                if guard.is_none() {
                    match std::process::Command::new("caffeinate")
                        .args(["-i", "-s", "-w", &pid])
                        .spawn()
                    {
                        Ok(child) => {
                            info!(
                                "Active client; holding idle-sleep assertion (display may still sleep)"
                            );
                            guard = Some(child);
                        }
                        Err(e) => {
                            warn!(error = %e, "Failed to start caffeinate; server may drop when the Mac sleeps")
                        }
                    }
                }
            } else if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
                info!(
                    idle_secs = idle,
                    "Idle past the timeout; releasing assertion so the Mac can sleep"
                );
            }
            tokio::time::sleep(Duration::from_secs(30)).await;
        }
    });
}

// --- Helpers ---

/// Run a blocking closure on the blocking pool and flatten the join error.
async fn blocking<T, F>(f: F) -> Result<T, ApiError>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| ApiError(e.to_string()))
}

/// The URL the desktop itself should open (loopback is always reachable).
///
/// In dev (`tauri dev`) the frontend is served by Vite with HMR on 1420 and its
/// API/file requests proxy to this server — so edits show live. The bundled
/// release serves the built frontend from axum on `PORT`.
pub fn local_url() -> String {
    if cfg!(debug_assertions) {
        "http://localhost:1420/".to_string()
    } else {
        format!("http://127.0.0.1:{PORT}/")
    }
}

/// Open the reader in Google Chrome on macOS. If a tab with the URL is already
/// open, focus it; otherwise open a new tab. Chrome is brought to the front.
pub fn open_in_browser() {
    let url = local_url();
    let script = format!(
        r#"tell application "Google Chrome"
    activate
    set theURL to "{url}"
    set foundTab to false
    repeat with w in windows
        set tabIndex to 1
        repeat with t in tabs of w
            if (URL of t) starts with theURL then
                set active tab index of w to tabIndex
                set index of w to 1
                set foundTab to true
                exit repeat
            end if
            set tabIndex to tabIndex + 1
        end repeat
        if foundTab then exit repeat
    end repeat
    if not foundTab then
        if (count of windows) is 0 then
            make new window
        end if
        tell window 1 to make new tab with properties {{URL:theURL}}
    end if
end tell"#
    );

    match std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .spawn()
    {
        Ok(_) => {}
        Err(e) => {
            warn!(error = %e, "Failed to open Chrome; falling back to default browser");
            let _ = std::process::Command::new("open").arg(url).spawn();
        }
    }
}

/// Best-effort primary LAN IP, for logging a reachable URL. Sends no packets;
/// connecting a UDP socket just selects the default-route interface.
fn lan_ip() -> Option<IpAddr> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|addr| addr.ip())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::{Body, to_bytes};
    use axum::http::{Method, Request};
    use serde_json::Value;
    use std::sync::Mutex;

    use crate::config::ConfigState;
    use crate::models::Config;

    fn app_with_cache_dir(cache_dir: &Path) -> tauri::App<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        app.manage(ConfigState(Mutex::new(Config {
            cache_dir: Some(cache_dir.to_string_lossy().into_owned()),
        })));
        app
    }

    fn store_test_router(app: AppHandle<tauri::test::MockRuntime>) -> Router {
        Router::new()
            .route(
                "/api/store/{key}",
                get(store_get::<tauri::test::MockRuntime>)
                    .put(store_put::<tauri::test::MockRuntime>)
                    .delete(store_delete::<tauri::test::MockRuntime>),
            )
            .layer(axum::middleware::from_fn(no_store_dynamic))
            .with_state(app)
    }

    fn api_request(method: Method, uri: &str, body: impl Into<Body>) -> Request<Body> {
        let mut req = Request::builder()
            .method(method)
            .uri(uri)
            .body(body.into())
            .expect("build request");
        req.extensions_mut()
            .insert(ConnectInfo(SocketAddr::from(([127, 0, 0, 1], 1430))));
        req
    }

    async fn send(router: &Router, req: Request<Body>) -> (StatusCode, String, Option<String>) {
        let res = router.clone().oneshot(req).await.expect("route request");
        let status = res.status();
        let cache_control = res
            .headers()
            .get(header::CACHE_CONTROL)
            .map(|value| value.to_str().expect("cache-control is ascii").to_string());
        let body = to_bytes(res.into_body(), 1024 * 1024)
            .await
            .expect("read response body");
        (
            status,
            String::from_utf8(body.to_vec()).expect("response body is utf-8"),
            cache_control,
        )
    }

    #[test]
    fn store_api_round_trips_persisted_json() {
        tauri::async_runtime::block_on(async {
            let cache_dir = tempfile::tempdir().expect("create cache dir");
            let app = app_with_cache_dir(cache_dir.path());
            let router = store_test_router(app.handle().clone());

            let (status, body, cache_control) = send(
                &router,
                api_request(Method::GET, "/api/store/reader", Body::empty()),
            )
            .await;
            assert_eq!(status, StatusCode::NOT_FOUND);
            assert_eq!(body, "");
            assert_eq!(cache_control.as_deref(), Some("no-store"));

            let (status, body, cache_control) = send(
                &router,
                api_request(Method::PUT, "/api/store/reader", r#"{"page":42}"#),
            )
            .await;
            assert_eq!(status, StatusCode::NO_CONTENT);
            assert_eq!(body, "");
            assert_eq!(cache_control.as_deref(), Some("no-store"));

            let (status, body, cache_control) = send(
                &router,
                api_request(Method::GET, "/api/store/reader", Body::empty()),
            )
            .await;
            assert_eq!(status, StatusCode::OK);
            assert_eq!(
                serde_json::from_str::<Value>(&body).expect("store body is json"),
                serde_json::json!({ "page": 42 })
            );
            assert_eq!(cache_control.as_deref(), Some("no-store"));

            let (status, body, cache_control) = send(
                &router,
                api_request(Method::DELETE, "/api/store/reader", Body::empty()),
            )
            .await;
            assert_eq!(status, StatusCode::NO_CONTENT);
            assert_eq!(body, "");
            assert_eq!(cache_control.as_deref(), Some("no-store"));

            let (status, body, cache_control) = send(
                &router,
                api_request(Method::GET, "/api/store/reader", Body::empty()),
            )
            .await;
            assert_eq!(status, StatusCode::NOT_FOUND);
            assert_eq!(body, "");
            assert_eq!(cache_control.as_deref(), Some("no-store"));
        });
    }

    #[test]
    fn store_api_rejects_invalid_keys_at_http_boundary() {
        tauri::async_runtime::block_on(async {
            let cache_dir = tempfile::tempdir().expect("create cache dir");
            let app = app_with_cache_dir(cache_dir.path());
            let router = store_test_router(app.handle().clone());

            for uri in ["/api/store/library.json", "/api/store/with%20space"] {
                for method in [Method::GET, Method::PUT, Method::DELETE] {
                    let body = if method == Method::PUT {
                        Body::from("{}")
                    } else {
                        Body::empty()
                    };
                    let (status, body, cache_control) =
                        send(&router, api_request(method, uri, body)).await;

                    assert_eq!(status, StatusCode::BAD_REQUEST);
                    assert_eq!(body, "Invalid store key");
                    assert_eq!(cache_control.as_deref(), Some("no-store"));
                }
            }

            assert!(!cache_dir.path().join("store").join("library.json").exists());
        });
    }
}
