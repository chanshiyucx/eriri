//! Menu-bar tray: the control center for library management.
//!
//! The menu is the only place to import libraries, set the cache directory, and
//! clear the cache — the web UI is purely for reading. The menu is rebuilt
//! after each mutating action so the library submenu and the cache-info footer
//! stay current.

use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Wry};
use tracing::error;

const TRAY_ID: &str = "eriri-tray";

pub fn setup(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let menu = build_menu(app.handle())?;
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Eriri")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| handle_event(app, event.id.as_ref()));

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// Rebuild the menu to reflect the latest libraries + cache stats.
pub fn rebuild(app: &AppHandle) {
    let app = app.clone();
    let _ = app.clone().run_on_main_thread(move || {
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            match build_menu(&app) {
                Ok(menu) => {
                    let _ = tray.set_menu(Some(menu));
                }
                Err(e) => error!(error = %e, "Failed to rebuild tray menu"),
            }
        }
    });
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let open = MenuItem::with_id(app, "open", "打开 Eriri", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;

    // 资源库 submenu: one entry per imported library (click reveals in Finder).
    // macOS sizes submenus to their widest item, so labels are padded to a
    // minimum width — there is no API to match the parent menu's width exactly.
    let summaries = crate::library::list_for_menu(app);
    let lib_items: Vec<MenuItem<Wry>> = if summaries.is_empty() {
        vec![MenuItem::with_id(
            app,
            "lib:none",
            pad_label("（暂无资源库）"),
            false,
            None::<&str>,
        )?]
    } else {
        summaries
            .iter()
            .map(|(id, name, _)| {
                MenuItem::with_id(
                    app,
                    format!("lib:{id}"),
                    pad_label(name),
                    true,
                    None::<&str>,
                )
            })
            .collect::<tauri::Result<Vec<_>>>()?
    };
    let lib_refs: Vec<&dyn IsMenuItem<Wry>> = lib_items
        .iter()
        .map(|i| i as &dyn IsMenuItem<Wry>)
        .collect();
    let library = Submenu::with_items(app, "资源库", true, &lib_refs)?;

    let import = MenuItem::with_id(app, "import", "导入资源", true, None::<&str>)?;
    let set_cache = MenuItem::with_id(app, "set-cache", "设置目录", true, None::<&str>)?;

    let sep2 = PredefinedMenuItem::separator(app)?;

    // Read-only cache info, with a clickable (confirmed) clear action below it.
    // A macOS menu item can't both open a submenu and fire on click, so the
    // info is shown as an inline disabled line rather than 清除缓存's submenu.
    let (count, size) = crate::thumbnail::get_thumbnail_stats(app.clone(), false).unwrap_or((0, 0));
    let info = MenuItem::with_id(
        app,
        "cache-info",
        format!("{count} 项 · {}", format_size(size)),
        false,
        None::<&str>,
    )?;
    let clean = MenuItem::with_id(app, "clean", "清除缓存", true, None::<&str>)?;

    let sep3 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &open, &sep1, &library, &import, &set_cache, &sep2, &info, &clean, &sep3, &quit,
        ],
    )
}

/// Pad a label to a minimum visual width (CJK counts as 2) with trailing
/// spaces, so the otherwise-narrow library submenu isn't cramped.
fn pad_label(name: &str) -> String {
    const MIN_WIDTH: usize = 22;
    let width: usize = name
        .chars()
        .map(|c| if (c as u32) >= 0x1100 { 2 } else { 1 })
        .sum();
    if width >= MIN_WIDTH {
        name.to_string()
    } else {
        format!("{name}{}", " ".repeat(MIN_WIDTH - width))
    }
}

fn handle_event(app: &AppHandle, id: &str) {
    match id {
        "open" => crate::server::open_in_browser(),
        "quit" => app.exit(0),
        "import" => spawn_import(app.clone()),
        "set-cache" => spawn_set_cache(app.clone()),
        "clean" => spawn_clean(app.clone()),
        other if other.starts_with("lib:") => {
            let lib_id = other.trim_start_matches("lib:");
            if lib_id != "none"
                && let Some(path) = crate::library::library_path(app, lib_id)
            {
                let _ = crate::scanner::utils::open_path_native(app.clone(), path);
            }
        }
        _ => {}
    }
}

fn spawn_import(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let Some(paths) = crate::scanner::utils::pick_directories_impl(&app).await else {
            return;
        };
        let app2 = app.clone();
        let created = tokio::task::spawn_blocking(move || {
            let mut created = false;
            for path in paths {
                match crate::library::import(&app2, &path) {
                    Ok(outcome) => created |= outcome.created,
                    Err(e) => error!(path = %path, error = %e, "Import failed"),
                }
            }
            created
        })
        .await
        .unwrap_or_else(|e| {
            error!(error = %e, "Import task panicked");
            false
        });

        if created {
            crate::server::rebuild_allowed_roots(&app);
            rebuild(&app);
        }
    });
}

fn spawn_set_cache(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let Some(path) = crate::scanner::utils::pick_directory_impl(&app).await else {
            return;
        };
        let app2 = app.clone();
        let updated = tokio::task::spawn_blocking(move || {
            if let Err(e) = crate::thumbnail::set_cache_dir(app2.clone(), path) {
                error!(error = %e, "Failed to set cache directory");
                return false;
            }
            if let Err(e) = crate::library::reopen(&app2) {
                error!(error = %e, "Failed to re-open library DB after cache dir change");
                return false;
            }
            let _ = crate::thumbnail::get_thumbnail_stats(app2, true);
            true
        })
        .await
        .unwrap_or_else(|e| {
            error!(error = %e, "Set cache task panicked");
            false
        });

        if updated {
            crate::server::rebuild_allowed_roots(&app);
            rebuild(&app);
        }
    });
}

fn spawn_clean(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if !confirm(&app, "清除缓存", "确认清除全部缓存？此操作不可撤销。").await
        {
            return;
        }
        let app2 = app.clone();
        // (0, 0) => no age/size threshold => clear everything.
        match tokio::task::spawn_blocking(move || {
            crate::thumbnail::clean_thumbnail_cache(app2, Some(0), Some(0))
        })
        .await
        {
            Ok(Ok(_)) => rebuild(&app),
            Ok(Err(e)) => error!(error = %e, "Failed to clean thumbnail cache"),
            Err(e) => error!(error = %e, "Clean cache task panicked"),
        }
    });
}

/// Show a native OK/Cancel confirmation, surfaced in front of the browser.
async fn confirm(app: &AppHandle, title: &str, message: &str) -> bool {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

    #[cfg(target_os = "macos")]
    let _ = app.run_on_main_thread(crate::scanner::utils::activate_foreground);

    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .message(message)
        .title(title)
        .buttons(MessageDialogButtons::OkCancel)
        .show(move |ok| {
            let _ = tx.send(ok);
        });
    rx.await.unwrap_or(false)
}

fn format_size(bytes: u64) -> String {
    const UNITS: [&str; 4] = ["B", "KB", "MB", "GB"];
    if bytes == 0 {
        return "0 B".to_string();
    }
    let mut size = bytes as f64;
    let mut unit = 0;
    while size >= 1024.0 && unit < UNITS.len() - 1 {
        size /= 1024.0;
        unit += 1;
    }
    format!("{size:.1} {}", UNITS[unit])
}
