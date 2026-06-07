mod config;
mod library;
mod models;
mod progress;
mod scanner;
mod server;
mod tags;
mod thumbnail;
mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            config::init(app)?;
            thumbnail::init(app)?;
            progress::init(app.handle())?;
            library::init(app.handle())?;
            server::init(app.handle());
            tray::setup(app)?;

            // Run as a menu-bar accessory: no Dock icon, no window on launch.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
