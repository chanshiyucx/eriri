use fast_image_resize as fr;
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
    THUMB_FALLBACK_HEIGHT, THUMB_WIDTH, add_stat, file_url, find_cover_image, get_thumbnail_dir,
    get_thumbnail_hash, is_image_file, process_and_get_dimensions,
};

use super::utils::{current_time_millis, generate_uuid, get_created_time, is_hidden};

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

                        if !thumb_path.exists()
                            && let Some(decompressor) = decompressor_opt.as_mut()
                            && let Ok((_, _, file_size)) = process_and_get_dimensions(
                                &cover_path,
                                &thumb_path,
                                decompressor,
                                resizer,
                            )
                            && file_size > 0
                        {
                            new_count.fetch_add(1, Ordering::Relaxed);
                            new_bytes.fetch_add(file_size, Ordering::Relaxed);
                        }

                        if thumb_path.exists() {
                            file_url(&thumb_path.to_string_lossy())
                        } else {
                            file_url(&cover_path.to_string_lossy())
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

pub fn scan_comic_images(app: AppHandle, comic_path: &str) -> Result<Vec<ComicImage>, String> {
    let start = std::time::Instant::now();
    let thumb_dir = get_thumbnail_dir(&app);
    let (images, total_new_count, total_new_bytes) =
        scan_comic_images_in(Path::new(comic_path), &thumb_dir)?;
    if total_new_count > 0 {
        add_stat(&app, total_new_count, total_new_bytes);
    }

    info!(
        count = images.len(),
        duration_ms = u64::try_from(start.elapsed().as_millis()).unwrap_or(u64::MAX),
        avg_ms = start.elapsed().as_millis() as f32 / images.len().max(1) as f32,
        "Processed comic images"
    );

    Ok(images)
}

/// Platform-independent scanner core. Keeping cache location and accounting as
/// explicit inputs/outputs makes the filesystem and image behavior unit-testable
/// without constructing a Tauri application.
fn scan_comic_images_in(
    comic_path: &Path,
    thumb_dir: &Path,
) -> Result<(Vec<ComicImage>, usize, u64), String> {
    let new_count = AtomicUsize::new(0);
    let new_bytes = AtomicU64::new(0);

    let entries = fs::read_dir(comic_path).map_err(|e| e.to_string())?;
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
                        hex::encode(hasher.finalize())
                    }
                };

                let thumb_path = thumb_dir.join(format!("{hash}.jpg"));

                let (width, height) = if let Some(decompressor) = decompressor_opt.as_mut()
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
                            (THUMB_WIDTH, THUMB_FALLBACK_HEIGHT)
                        }
                    }
                } else {
                    (THUMB_WIDTH, THUMB_FALLBACK_HEIGHT)
                };

                let thumbnail = if thumb_path.exists() {
                    file_url(&thumb_path.to_string_lossy())
                } else {
                    file_url(&path_str)
                };

                let (starred, deleted) = get_file_tags(file_path);
                let url = file_url(&path_str);

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
    images.sort_by(|a, b| natord::compare(&a.filename, &b.filename));
    images.iter_mut().enumerate().for_each(|(i, img)| {
        img.index = i as u32;
    });

    Ok((images, total_new_count, total_new_bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};

    fn write_image(path: &Path, width: u32, height: u32) {
        RgbImage::from_pixel(width, height, Rgb([20, 40, 60]))
            .save(path)
            .expect("write comic image");
    }

    #[test]
    fn scans_images_naturally_filters_entries_and_reuses_thumbnails() {
        let comic = tempfile::tempdir().expect("create comic dir");
        let thumbnails = tempfile::tempdir().expect("create thumbnail dir");
        write_image(&comic.path().join("10.jpg"), 30, 15);
        write_image(&comic.path().join("2.png"), 20, 40);
        fs::write(comic.path().join("broken.jpg"), "not an image").expect("write broken image");
        fs::write(comic.path().join("notes.txt"), "ignore").expect("write non-image file");
        write_image(&comic.path().join(".hidden.jpg"), 10, 10);
        fs::create_dir(comic.path().join("nested.png")).expect("create misleading directory");

        let (images, created_count, created_bytes) =
            scan_comic_images_in(comic.path(), thumbnails.path()).expect("scan comic images");

        assert_eq!(
            images
                .iter()
                .map(|image| (image.filename.as_str(), image.index))
                .collect::<Vec<_>>(),
            vec![("2.png", 0), ("10.jpg", 1), ("broken.jpg", 2)]
        );
        assert_eq!((images[0].width, images[0].height), (20, 40));
        assert_eq!((images[1].width, images[1].height), (30, 15));
        assert_eq!(
            (images[2].width, images[2].height),
            (THUMB_WIDTH, THUMB_FALLBACK_HEIGHT)
        );
        assert_ne!(images[0].thumbnail, images[0].url);
        assert!(images[0].thumbnail.starts_with("/file?path="));
        assert_eq!(images[2].thumbnail, images[2].url);
        assert_eq!(created_count, 2);
        assert!(created_bytes > 0);

        let (cached_images, cached_count, cached_bytes) =
            scan_comic_images_in(comic.path(), thumbnails.path()).expect("rescan comic images");
        assert_eq!(cached_images.len(), 3);
        assert_eq!((cached_count, cached_bytes), (0, 0));
    }

    #[test]
    fn reports_missing_comic_directories() {
        let dir = tempfile::tempdir().expect("create parent dir");
        let missing = dir.path().join("missing");

        assert!(scan_comic_images_in(&missing, dir.path()).is_err());
    }
}
