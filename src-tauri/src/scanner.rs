use percent_encoding::utf8_percent_encode;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::BufWriter;
use std::path::{Path, PathBuf};
use uuid::Uuid;
use image::imageops::FilterType;
use image::codecs::jpeg::JpegEncoder;
use image::ExtendedColorType;
use sha2::{Digest, Sha256};
use rayon::prelude::*;
use tauri::{AppHandle, Manager};
use natord;

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif"];
const BOOK_EXTENSIONS: &[&str] = &["txt"];
const NAMESPACE: &str = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

const ENCODE_SET: percent_encoding::AsciiSet = percent_encoding::NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'_')
    .remove(b'.')
    .remove(b'!')
    .remove(b'~')
    .remove(b'*')
    .remove(b'\'')
    .remove(b'(')
    .remove(b')');

const THUMB_WIDTH: u32 = 256;
const THUMB_QUALITY: u8 = 70;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Book {
    id: String,
    title: String,
    path: String,
    #[serde(rename = "authorId")]
    author_id: String,
    #[serde(rename = "libraryId")]
    library_id: String,
    size: u64,
    #[serde(rename = "createdAt")]
    created_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Author {
    id: String,
    name: String,
    path: String,
    #[serde(rename = "libraryId")]
    library_id: String,
    books: Vec<Book>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Comic {
    id: String,
    title: String,
    path: String,
    cover: String,
    #[serde(rename = "libraryId")]
    library_id: String,
    #[serde(rename = "pageCount")]
    page_count: usize,
    #[serde(rename = "createdAt")]
    created_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComicImage {
    url: String,
    thumbnail: String,
    filename: String,
    width: u32,
    height: u32,
}

#[derive(Debug)]
pub struct CacheFile {
    path: PathBuf,
    size: u64,
    time_secs: u64,
}

fn generate_uuid(input: &str) -> String {
    let namespace = Uuid::parse_str(NAMESPACE).unwrap();
    Uuid::new_v5(&namespace, input.as_bytes()).to_string()
}

fn remove_extension(filename: &str) -> String {
    Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename)
        .to_string()
}

fn is_book_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext_str| BOOK_EXTENSIONS.contains(&ext_str.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn is_image_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext_str| IMAGE_EXTENSIONS.contains(&ext_str.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn convert_file_src(path: &str) -> String {
    let encoded_path = utf8_percent_encode(path, &ENCODE_SET).to_string();
    format!("asset://localhost/{}", encoded_path)
}

fn get_created_time(metadata: &fs::Metadata) -> u64 {
    metadata
        .created()
        .or_else(|_| metadata.modified())
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64
        })
        .unwrap_or_else(|_| {
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64
        })
}

fn get_thumbnail_hash(file_path: &Path) -> String {
    let mut hasher = Sha256::new();
    hasher.update(file_path.to_string_lossy().as_bytes());
    format!("{:x}", hasher.finalize())
}

fn generate_thumbnail(source_path: &Path, thumb_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    if thumb_path.exists() {
        return Ok(());
    }

    let img = image::open(source_path)?;
    
    let thumb = img.resize(THUMB_WIDTH, u32::MAX, FilterType::Triangle);
    
    let rgb_thumb = thumb.to_rgb8();
    
    let file = File::create(thumb_path)?;
    let mut writer = BufWriter::new(file);
    
    let mut encoder = JpegEncoder::new_with_quality(&mut writer, THUMB_QUALITY);
    encoder.encode(
        rgb_thumb.as_raw(),
        rgb_thumb.width(),
        rgb_thumb.height(),
        ExtendedColorType::Rgb8,
    )?;
    
    Ok(())
}

#[tauri::command]
pub fn is_book_library(library_path: String) -> Result<bool, String> {
    let path = Path::new(&library_path);
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            let sub_path = entry.path();
            if let Ok(sub_entries) = fs::read_dir(&sub_path) {
                for sub_entry in sub_entries.flatten() {
                    if is_book_file(&sub_entry.path()) {
                        return Ok(true);
                    }
                }
            }
            break;
        }
    }

    Ok(false)
}

#[tauri::command]
pub fn scan_book_library(
    library_path: String,
    library_id: String,
) -> Result<Vec<Author>, String> {
    let path = Path::new(&library_path);
    let mut authors = Vec::new();

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            continue;
        }

        let author_name = entry.file_name().to_string_lossy().to_string();
        let author_path = entry.path();
        let author_id = generate_uuid(&author_path.to_string_lossy());

        let mut books = Vec::new();

        if let Ok(author_entries) = fs::read_dir(&author_path) {
            for book_entry in author_entries.flatten() {
                let book_path = book_entry.path();

                if !is_book_file(&book_path) {
                    continue;
                }

                let book_id = generate_uuid(&book_path.to_string_lossy());
                let title = remove_extension(&book_entry.file_name().to_string_lossy());

                let (size, created_at) = if let Ok(metadata) = book_entry.metadata() {
                    (metadata.len(), get_created_time(&metadata))
                } else {
                    (
                        0,
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as u64,
                    )
                };

                books.push(Book {
                    id: book_id,
                    title,
                    path: book_path.to_string_lossy().to_string(),
                    author_id: author_id.clone(),
                    library_id: library_id.clone(),
                    size,
                    created_at,
                });
            }
        }

        authors.push(Author {
            id: author_id,
            name: author_name,
            path: author_path.to_string_lossy().to_string(),
            library_id: library_id.clone(),
            books,
        });
    }

    Ok(authors)
}

#[tauri::command]
pub async fn scan_comic_library(
    app: AppHandle,
    library_path: String,
    library_id: String,
) -> Result<Vec<Comic>, String> {
    let start = std::time::Instant::now();
    let path = Path::new(&library_path);

    // Resolve cache directory
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let thumb_dir = cache_dir.join("thumbnails");
    
    if !thumb_dir.exists() {
        fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;
    }

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let entries_vec: Vec<_> = entries.flatten().collect();


    // Use par_iter for parallel processing of comics
    let processed_comics: Vec<Comic> = entries_vec
        .par_iter()
        .filter_map(|entry| {
            if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                return None;
            }

            let comic_name = entry.file_name().to_string_lossy().to_string();
            let comic_path = entry.path();
            let comic_id = generate_uuid(&comic_path.to_string_lossy());

            let created_at = entry
                .metadata()
                .ok()
                .map(|m| get_created_time(&m))
                .unwrap_or_else(|| {
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64
                });

            let mut cover = String::new();
            let mut page_count = 0;
            
            if let Ok(files) = fs::read_dir(&comic_path) {
                let mut first_image_name: Option<String> = None;
                let mut first_image_path: Option<PathBuf> = None;

                for entry in files.flatten() {
                    if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                        let path = entry.path();
                        if is_image_file(&path) {
                            page_count += 1;
                            let name = entry.file_name().to_string_lossy().to_string();
                            
                            let is_new_first = match &first_image_name {
                                None => true,
                                Some(current_first) => natord::compare(&name, current_first) == std::cmp::Ordering::Less,
                            };

                            if is_new_first {
                                first_image_name = Some(name);
                                first_image_path = Some(path);
                            }
                        }
                    }
                }

                if let Some(path) = first_image_path {
                    // Generate thumbnail for cover
                    let hash = get_thumbnail_hash(&path);
                    let thumb_path = thumb_dir.join(format!("{}.jpg", hash));
                    
                    if let Err(e) = generate_thumbnail(&path, &thumb_path) {
                        eprintln!("⚠️  Failed to generate thumbnail for cover {}: {}", comic_name, e);
                    }

                    cover = if thumb_path.exists() {
                        convert_file_src(&thumb_path.to_string_lossy())
                    } else {
                        convert_file_src(&path.to_string_lossy())
                    };
                }
            }

            Some(Comic {
                id: comic_id,
                title: comic_name,
                path: comic_path.to_string_lossy().to_string(),
                cover,
                library_id: library_id.clone(),
                page_count,
                created_at,
            })
        })
        .collect();
    
    // Sort comics by title naturally
    let mut comics = processed_comics;
    comics.sort_by(|a, b| natord::compare(&a.title, &b.title));

    let duration = start.elapsed();
    println!(
        "✅ Scanned library with {} comics in {:.2}s",
        comics.len(),
        duration.as_secs_f32()
    );

    Ok(comics)
}

#[tauri::command]
pub async fn scan_comic_images(
    app: AppHandle,
    comic_path: String,
) -> Result<Vec<ComicImage>, String> {
    let start = std::time::Instant::now();
    let path = Path::new(&comic_path);
    
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let thumb_dir = cache_dir.join("thumbnails");
    
    if !thumb_dir.exists() {
        fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;
    }

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let image_paths: Vec<PathBuf> = entries
        .flatten()
        .filter(|e| {
            e.file_type().map(|ft| ft.is_file()).unwrap_or(false)
                && is_image_file(&e.path())
        })
        .map(|e| e.path())
        .collect();

    println!("📚 Found {} images", image_paths.len());

    let images: Vec<ComicImage> = image_paths
        .par_iter()
        .map(|file_path| {
            let filename = file_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            
            let hash = get_thumbnail_hash(file_path);
            let thumb_path = thumb_dir.join(format!("{}.jpg", hash));
            
            if let Err(e) = generate_thumbnail(file_path, &thumb_path) {
                eprintln!("⚠️  Failed to generate thumbnail for {}: {}", filename, e);
            }

            let thumbnail = if thumb_path.exists() {
                convert_file_src(&thumb_path.to_string_lossy())
            } else {
                convert_file_src(&file_path.to_string_lossy())
            };

            // Get image dimensions
            let (width, height) = image::open(file_path)
                .map(|img| (img.width(), img.height()))
                .unwrap_or((0, 0));

            ComicImage {
                filename,
                url: convert_file_src(&file_path.to_string_lossy()),
                thumbnail,
                width,
                height,
            }
        })
        .collect();

    let mut sorted_images = images;
    sorted_images.sort_by(|a, b| natord::compare(&a.filename, &b.filename));

    let duration = start.elapsed();
    println!(
        "✅ Processed {} images in {:.2}s ({:.0}ms per image)",
        sorted_images.len(),
        duration.as_secs_f32(),
        duration.as_millis() as f32 / sorted_images.len().max(1) as f32
    );

    Ok(sorted_images)
}

#[tauri::command]
pub async fn clean_thumbnail_cache(
    app: AppHandle,
    days_old: Option<u64>,
    max_size_mb: Option<u64>, 
) -> Result<(usize, u64), String> {
    use std::time::SystemTime;
    
    let days = days_old.unwrap_or(30);
    let max_size = max_size_mb.unwrap_or(1024) * 1024 * 1024; 
    
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let thumb_dir = cache_dir.join("thumbnails");
    
    if !thumb_dir.exists() {
        return Ok((0, 0));
    }
    
    let now = SystemTime::now();
    let cutoff_time = now
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs()
        - (days * 24 * 60 * 60);
    
    let mut deleted_count = 0;
    let mut freed_bytes = 0u64;
    
    let mut valid_files = Vec::new();
    let mut current_total_size = 0u64;
    
    if let Ok(entries) = fs::read_dir(&thumb_dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if !metadata.is_file() { continue; }

                let time = metadata.modified().unwrap_or(now);
                
                let time_secs = time
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                
                let size = metadata.len();

                if time_secs < cutoff_time {
                    if fs::remove_file(entry.path()).is_ok() {
                        freed_bytes += size;
                        deleted_count += 1;
                    }
                } else {
                    valid_files.push(CacheFile {
                        path: entry.path(),
                        size,
                        time_secs,
                    });
                    current_total_size += size;
                }
            }
        }
    }

    if current_total_size > max_size {
        valid_files.sort_by_key(|f| f.time_secs);

        for file in valid_files {
            if current_total_size <= max_size {
                break; 
            }

            if fs::remove_file(&file.path).is_ok() {
                freed_bytes += file.size;
                current_total_size -= file.size;
                deleted_count += 1;
            }
        }
    }
    
    println!(
        "🗑️ Cleaned {} thumbnails, freed {:.2} MB",
        deleted_count,
        freed_bytes as f64 / 1024.0 / 1024.0
    );
    
    Ok((deleted_count, freed_bytes))
}

#[tauri::command]
pub async fn get_thumbnail_stats(
    app: AppHandle,
) -> Result<(usize, u64), String> {
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let thumb_dir = cache_dir.join("thumbnails");
    
    if !thumb_dir.exists() {
        return Ok((0, 0));
    }
    
    let mut count = 0;
    let mut total_size = 0u64;
    
    if let Ok(entries) = fs::read_dir(&thumb_dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    count += 1;
                    total_size += metadata.len();
                }
            }
        }
    }
    
    Ok((count, total_size))
}