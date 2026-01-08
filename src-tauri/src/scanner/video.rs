use natord;
use rayon::prelude::*;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tracing::info;

use crate::models::Video;
use crate::tags::get_file_tags;
use crate::thumbnail::{convert_file_src, generate_video_thumbnail, get_thumbnail_dir, get_thumbnail_hash};

use super::utils::{
    current_time_millis, generate_uuid, get_created_time, is_hidden, is_video_file,
    remove_extension,
};

#[tauri::command]
pub fn scan_video_library(
    app: AppHandle,
    library_path: &str,
    library_id: &str,
) -> Result<Vec<Video>, String> {
    let start = std::time::Instant::now();
    let path = Path::new(library_path);

    let thumb_dir = get_thumbnail_dir(&app);
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let sidecar_path = resource_dir.join("swift").join("video-cover");

    let sidecar_executable = if sidecar_path.exists() {
        sidecar_path
    } else {
        let dev_path = PathBuf::from("src-tauri/swift/video-cover");
        if dev_path.exists() {
            dev_path
        } else {
            PathBuf::from("./swift/video-cover")
        }
    };

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let tasks: Vec<_> = entries
        .flatten()
        .filter_map(|entry| {
            let entry_path = entry.path();
            let is_valid = !is_hidden(&entry_path)
                && entry.file_type().map(|ft| ft.is_file()).unwrap_or(false)
                && is_video_file(&entry_path);
            is_valid.then_some(entry_path)
        })
        .collect();

    let processed_videos: Vec<Video> = tasks
        .par_iter()
        .map(|video_path| {
            let path_str = video_path.to_string_lossy();
            let id = generate_uuid(&path_str);
            let title = video_path
                .file_name()
                .map(|n| remove_extension(&n.to_string_lossy()))
                .unwrap_or_default();

            let (size, created_at, hash) = fs::metadata(video_path)
                .map(|m| (m.len(), get_created_time(&m), get_thumbnail_hash(&m)))
                .unwrap_or_else(|_| (0, current_time_millis(), generate_uuid(&title)));

            let (starred, deleted) = get_file_tags(video_path);
            let thumb_path = thumb_dir.join(format!("{hash}.jpg"));

            if !thumb_path.exists() {
                let _ = generate_video_thumbnail(video_path, &thumb_path, &sidecar_executable);
            }

            let cover = if thumb_path.exists() {
                convert_file_src(&thumb_path.to_string_lossy())
            } else {
                String::new()
            };

            let url = convert_file_src(&path_str);

            Video {
                id,
                title,
                path: path_str.into_owned(),
                url,
                cover,
                library_id: library_id.to_string(),
                created_at,
                size,
                duration: 0,
                starred,
                deleted,
            }
        })
        .collect();

    let mut videos = processed_videos;
    videos.sort_by(|a, b| natord::compare(&a.title, &b.title));

    info!(
        count = videos.len(),
        duration_ms = u64::try_from(start.elapsed().as_millis()).unwrap_or(u64::MAX),
        "Scanned video library"
    );

    Ok(videos)
}
