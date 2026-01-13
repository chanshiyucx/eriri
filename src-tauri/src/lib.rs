mod bookmark;
mod config;
mod models;
mod scanner;
mod tags;
mod thumbnail;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            config::init(app)?;
            thumbnail::init(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scanner::utils::generate_uuid_command,
            scanner::utils::get_library_type,
            scanner::utils::open_path_native,
            scanner::book::scan_book_library,
            scanner::video::scan_video_library,
            scanner::comic::scan_comic_library,
            scanner::comic::scan_comic_images,
            thumbnail::clean_thumbnail_cache,
            thumbnail::get_thumbnail_stats,
            thumbnail::get_cache_dir,
            thumbnail::set_cache_dir,
            tags::set_file_tag,
            config::read_store_data,
            config::write_store_data,
            config::remove_store_data,
            bookmark::create_bookmark,
            bookmark::resolve_bookmark,
            bookmark::restore_bookmarks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

