use fast_image_resize as fr;
use natord;
use rayon::prelude::*;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use tauri::AppHandle;
use tracing::{info, warn};
use turbojpeg::Decompressor;

use crate::models::{Comic, ComicImage};
use crate::tags::get_file_tags;
use crate::thumbnail::{
    add_stat, convert_file_src, find_cover_image, get_thumbnail_dir, get_thumbnail_hash,
    is_image_file, process_and_get_dimensions, THUMB_HEIGHT, THUMB_WIDTH,
};

use super::utils::{current_time_millis, generate_uuid, get_created_time, is_hidden};

#[tauri::command]
pub fn scan_comic_library(
    app: AppHandle,
    library_path: &str,
    library_id: &str,
) -> Result<Vec<Comic>, String> {
    let start = std::time::Instant::now();
    let path = Path::new(library_path);

    let thumb_dir = get_thumbnail_dir(&app);
    let new_count = AtomicUsize::new(0);
    let new_bytes = AtomicU64::new(0);

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let entries_vec: Vec<_> = entries
        .flatten()
        .filter(|e| !is_hidden(&e.path()))
        .collect();

    let mut comics: Vec<Comic> = entries_vec
        .par_iter()
        .map_init(
            || {
                let decompressor = Decompressor::new().ok();
                let resizer = fr::Resizer::new();
                (decompressor, resizer)
            },
            |(decompressor_opt, resizer), entry| {
                if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                    return None;
                }

                let comic_path = entry.path();
                let path_str = comic_path.to_string_lossy();
                let comic_name = entry.file_name().to_string_lossy().into_owned();
                let comic_id = generate_uuid(&path_str);

                let created_at = entry
                    .metadata()
                    .map(|m| get_created_time(&m))
                    .unwrap_or_else(|_| current_time_millis());

                let cover = find_cover_image(&comic_path)
                    .and_then(|cover_path| fs::metadata(&cover_path).ok().map(|m| (cover_path, m)))
                    .map(|(cover_path, cover_meta)| {
                        let hash = get_thumbnail_hash(&cover_meta);
                        let thumb_path = thumb_dir.join(format!("{hash}.jpg"));

                        if !thumb_path.exists() {
                            if let Some(ref mut decompressor) = decompressor_opt.as_mut() {
                                if let Ok((_, _, file_size)) = process_and_get_dimensions(
                                    &cover_path,
                                    &thumb_path,
                                    decompressor,
                                    resizer,
                                ) {
                                    if file_size > 0 {
                                        new_count.fetch_add(1, Ordering::Relaxed);
                                        new_bytes.fetch_add(file_size, Ordering::Relaxed);
                                    }
                                }
                            }
                        }

                        if thumb_path.exists() {
                            convert_file_src(&thumb_path.to_string_lossy())
                        } else {
                            convert_file_src(&cover_path.to_string_lossy())
                        }
                    })
                    .unwrap_or_default();

                let (starred, deleted) = get_file_tags(&comic_path);

                Some(Comic {
                    id: comic_id,
                    title: comic_name,
                    path: path_str.into_owned(),
                    cover,
                    library_id: library_id.to_string(),
                    created_at,
                    starred,
                    deleted,
                })
            },
        )
        .flatten()
        .collect();

    let total_new_count = new_count.load(Ordering::Relaxed);
    let total_new_bytes = new_bytes.load(Ordering::Relaxed);
    if total_new_count > 0 {
        add_stat(&app, total_new_count, total_new_bytes);
    }

    comics.sort_by(|a, b| natord::compare(&a.title, &b.title));

    info!(
        count = comics.len(),
        duration_ms = u64::try_from(start.elapsed().as_millis()).unwrap_or(u64::MAX),
        "Scanned comic library"
    );

    Ok(comics)
}

#[tauri::command]
pub fn scan_comic_images(app: AppHandle, comic_path: &str) -> Result<Vec<ComicImage>, String> {
    let start = std::time::Instant::now();
    let path = Path::new(comic_path);

    let thumb_dir = get_thumbnail_dir(&app);
    let new_count = AtomicUsize::new(0);
    let new_bytes = AtomicU64::new(0);

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let image_paths: Vec<PathBuf> = entries
        .flatten()
        .filter_map(|e| {
            let path = e.path();
            let is_valid = !is_hidden(&path)
                && e.file_type().map(|ft| ft.is_file()).unwrap_or(false)
                && is_image_file(&path);
            is_valid.then_some(path)
        })
        .collect();

    info!(count = image_paths.len(), "Found images");

    let mut images: Vec<ComicImage> = image_paths
        .par_iter()
        .map_init(
            || {
                let decompressor = Decompressor::new().ok();
                let resizer = fr::Resizer::new();
                (decompressor, resizer)
            },
        |(decompressor_opt, resizer), file_path| {
                let path_str = file_path.to_string_lossy();
                let filename = file_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned();

                let hash = match fs::metadata(file_path) {
                    Ok(metadata) => get_thumbnail_hash(&metadata),
                    Err(_) => {
                        let mut hasher = Sha256::new();
                        hasher.update(path_str.as_bytes());
                        format!("{:x}", hasher.finalize())
                    }
                };

                let thumb_path = thumb_dir.join(format!("{hash}.jpg"));

                let (width, height) = if let Some(ref mut decompressor) = decompressor_opt.as_mut()
                {
                    match process_and_get_dimensions(file_path, &thumb_path, decompressor, resizer) {
                        Ok((w, h, file_size)) => {
                            if file_size > 0 {
                                new_count.fetch_add(1, Ordering::Relaxed);
                                new_bytes.fetch_add(file_size, Ordering::Relaxed);
                            }
                            (w, h)
                        }
                        Err(e) => {
                            warn!(error = %e, path = %file_path.display(), "Failed to process image");
                            (THUMB_WIDTH, THUMB_HEIGHT)
                        }
                    }
                } else {
                    (THUMB_WIDTH, THUMB_HEIGHT)
                };

                let thumbnail = if thumb_path.exists() {
                    convert_file_src(&thumb_path.to_string_lossy())
                } else {
                    convert_file_src(&path_str)
                };

                let (starred, deleted) = get_file_tags(file_path);
                let url = convert_file_src(&path_str);

                ComicImage {
                    path: path_str.into_owned(),
                    filename,
                    url,
                    thumbnail,
                    width,
                    height,
                    starred,
                    deleted,
                    index: 0,
                }
            },
        )
        .collect();

    let total_new_count = new_count.load(Ordering::Relaxed);
    let total_new_bytes = new_bytes.load(Ordering::Relaxed);
    if total_new_count > 0 {
        add_stat(&app, total_new_count, total_new_bytes);
    }

    images.sort_by(|a, b| natord::compare(&a.filename, &b.filename));
    images.iter_mut().enumerate().for_each(|(i, img)| {
        img.index = i as u32;
    });

    info!(
        count = images.len(),
        duration_ms = u64::try_from(start.elapsed().as_millis()).unwrap_or(u64::MAX),
        avg_ms = start.elapsed().as_millis() as f32 / images.len().max(1) as f32,
        "Processed comic images"
    );

    Ok(images)
}
