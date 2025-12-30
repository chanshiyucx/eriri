use percent_encoding::utf8_percent_encode;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::BufWriter;
use std::path::{Path, PathBuf};
use std::io::BufReader;
use std::num::NonZeroU32;
use std::process::Command;
use std::os::unix::fs::MetadataExt;
use image::ImageReader;
use image::codecs::jpeg::JpegEncoder;
use image::ExtendedColorType;
use uuid::Uuid;
use sha2::{Digest, Sha256};
use rayon::prelude::*;
use tauri::{AppHandle, Manager};
use memmap2::Mmap;
use turbojpeg::{Decompressor, Image, PixelFormat, ScalingFactor};
use fast_image_resize as fr;
use natord;
use xattr;
use plist;

const TAG_KEY: &str = "com.apple.metadata:_kMDItemUserTags";
const FINDER_INFO_KEY: &str = "com.apple.FinderInfo";
const STAR_TAG_NAME: &str = "STAR"; 
const STAR_TAG_VALUE: &str = "STAR\n5";
const DELETE_TAG_NAME: &str = "DELETE";
const DELETE_TAG_VALUE: &str = "DELETE\n6";

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png"];
const VIDEO_EXTENSIONS: &[&str] = &["mp4"];
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
    starred: bool,
    deleted: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Author {
    id: String,
    name: String,
    path: String,
    #[serde(rename = "libraryId")]
    library_id: String,
    book_count: u32,
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
    #[serde(rename = "createdAt")]
    created_at: u64,
    starred: bool,
    deleted: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Video {
    id: String,
    title: String,
    path: String,
    url: String,
    cover: String,
    #[serde(rename = "libraryId")]
    library_id: String,
    #[serde(rename = "createdAt")]
    created_at: u64,
    size: u64,
    duration: u64,
    starred: bool,
    deleted: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComicImage {
    path: String,
    url: String,
    thumbnail: String,
    filename: String,
    width: u32,
    height: u32,
    starred: bool,
    deleted: bool,
}



#[derive(Deserialize)]
pub struct FileTags {
    starred: Option<bool>,
    deleted: Option<bool>,
}

fn is_jpeg(data: &[u8]) -> bool {
    data.len() > 2 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF
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
        .map(|ext_str| {
            BOOK_EXTENSIONS.iter().any(|&x| x.eq_ignore_ascii_case(ext_str))
        })
        .unwrap_or(false)
}

fn is_image_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext_str| {
            IMAGE_EXTENSIONS.iter().any(|&x| x.eq_ignore_ascii_case(ext_str))
        })
        .unwrap_or(false)
}

fn is_video_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext_str| {
            VIDEO_EXTENSIONS.iter().any(|&x| x.eq_ignore_ascii_case(ext_str))
        })
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

fn get_thumbnail_hash(metadata: &fs::Metadata) -> String {
    let mut hasher = Sha256::new();
    hasher.update(metadata.ino().to_le_bytes());
    hasher.update(metadata.len().to_le_bytes());
    hasher.update(metadata.mtime().to_le_bytes());
    format!("{:x}", hasher.finalize())
}

fn get_file_tags(path: &Path) -> (bool, bool) {
    if let Ok(Some(value)) = xattr::get(path, TAG_KEY) {
        if let Ok(plist::Value::Array(tags)) = plist::from_bytes(&value) {
            let mut starred = false;
            let mut deleted = false;
            
            for tag in tags {
                if let Some(tag_str) = tag.as_string() {
                    let name = tag_str.split('\n').next().unwrap_or("");
                    if name.eq_ignore_ascii_case(STAR_TAG_NAME) {
                        starred = true;
                    }  
                    if name.eq_ignore_ascii_case(DELETE_TAG_NAME) {
                        deleted = true;
                    }
                    
                    if starred && deleted {
                        break; 
                    }
                }
            }
            return (starred, deleted);
        }
    }
    (false, false)
}

fn set_file_tag_impl(path: &Path, tags: FileTags) -> Result<(), Box<dyn std::error::Error>> {
    let mut tags_list = Vec::new();
    
    if let Ok(Some(value)) = xattr::get(path, TAG_KEY) {
        if let Ok(plist::Value::Array(existing_tags)) = plist::from_bytes(&value) {
            for tag in existing_tags {
                if let Some(s) = tag.as_string() {
                    tags_list.push(s.to_string());
                }
            }
        }
    }

    if let Some(is_starred) = tags.starred {
        let has_star = tags_list.iter().any(|t| {
            let name = t.split('\n').next().unwrap_or("");
            name.eq_ignore_ascii_case(STAR_TAG_NAME)
        });

        if is_starred {
            if !has_star {
                tags_list.push(STAR_TAG_VALUE.to_string());
            }
        } else {
            if has_star {
                tags_list.retain(|t| {
                    let name = t.split('\n').next().unwrap_or("");
                    !name.eq_ignore_ascii_case(STAR_TAG_NAME)
                });
            }
        }
    }

    if let Some(is_deleted) = tags.deleted {
        let has_delete = tags_list.iter().any(|t| {
            let name = t.split('\n').next().unwrap_or("");
            name.eq_ignore_ascii_case(DELETE_TAG_NAME)
        });

        if is_deleted {
            if !has_delete {
                tags_list.push(DELETE_TAG_VALUE.to_string());
            }
        } else {
            if has_delete {
                tags_list.retain(|t| {
                    let name = t.split('\n').next().unwrap_or("");
                    !name.eq_ignore_ascii_case(DELETE_TAG_NAME)
                });
            }
        }
    }

    let plist_tags: Vec<plist::Value> = tags_list.into_iter().map(plist::Value::String).collect();
    let value = plist::Value::Array(plist_tags);
    let mut buf = Vec::new();
    
    value.to_writer_xml(&mut buf)?; 
    xattr::set(path, TAG_KEY, &buf)?;


    if let Ok(Some(mut data)) = xattr::get(path, FINDER_INFO_KEY) {
        if data.len() >= 32 {
            data[9] &= !0x0E; 
            xattr::set(path, FINDER_INFO_KEY, &data)?;
        }
    }

    Ok(())
}

fn get_image_dimensions_fast(path: &Path) -> Result<(u32, u32), Box<dyn std::error::Error>> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let reader = ImageReader::new(reader).with_guessed_format()?;
    let (width, height) = reader.into_dimensions()?;
    Ok((width, height))
}

fn process_and_get_dimensions(
    source_path: &Path, 
    thumb_path: &Path,
    decompressor: &mut Decompressor, 
    resizer: &mut fr::Resizer,       
) -> Result<(u32, u32), Box<dyn std::error::Error>> {
    if thumb_path.exists() {
        if let Ok((w, h)) = get_image_dimensions_fast(thumb_path) {
            return Ok((w, h));
        }
    }

    let file = File::open(source_path)?;
    let mmap = unsafe { Mmap::map(&file)? };

    if is_jpeg(&mmap) {
        let header = decompressor.read_header(&mmap)?; 
        let (orig_width, orig_height) = (header.width as u32, header.height as u32);
        
        let scale_ratio = orig_width / THUMB_WIDTH;
        let (num, denom) = match scale_ratio {
            r if r >= 8 => (1, 8),
            r if r >= 4 => (1, 4),
            r if r >= 2 => (1, 2),
            _ => (1, 1),
        };

        let scaling_factor = ScalingFactor::new(num, denom);
        
        let scaled_width = (header.width * num + denom - 1) / denom;
        let scaled_height = (header.height * num + denom - 1) / denom;

        let pitch = scaled_width * 3;
        let mut pixels = vec![0u8; pitch * scaled_height];
        
        let image = Image {
            pixels: &mut pixels[..],
            width: scaled_width,
            pitch,
            height: scaled_height,
            format: PixelFormat::RGB,
        };

        decompressor.set_scaling_factor(scaling_factor)?;
        decompressor.decompress(&mmap, image)?;
        return resize_and_save(
            pixels, scaled_width as u32, scaled_height as u32,
            orig_width, orig_height, thumb_path, resizer
        );

    } else {
        let reader = ImageReader::new(std::io::Cursor::new(&mmap[..]))
            .with_guessed_format()?;
        let img = reader.decode()?;
        let (width, height) = (img.width(), img.height());

        return resize_and_save(
            img.into_rgb8().into_raw(), width, height,
            width, height, thumb_path, resizer
        );
    }
}

fn resize_and_save(
    src_pixels: Vec<u8>,
    src_w: u32, src_h: u32,
    orig_w: u32, orig_h: u32,
    thumb_path: &Path,
    resizer: &mut fr::Resizer 
) -> Result<(u32, u32), Box<dyn std::error::Error>> {
    
    let target_width = THUMB_WIDTH;
    let target_height = (orig_h as f64 * (target_width as f64 / orig_w as f64)) as u32;

    let src_width = NonZeroU32::new(src_w).ok_or("Src width is 0")?;
    let src_height = NonZeroU32::new(src_h).ok_or("Src height is 0")?;
    let src_image = fr::images::Image::from_vec_u8(
        src_width.get(), src_height.get(), src_pixels, fr::PixelType::U8x3,
    )?;

    let dst_width = NonZeroU32::new(target_width).ok_or("Dst width is 0")?;
    let dst_height = NonZeroU32::new(target_height).ok_or("Dst height is 0")?;
    let mut dst_image = fr::images::Image::new(
        dst_width.get(), dst_height.get(), src_image.pixel_type(),
    );

    let options = fr::ResizeOptions::new().resize_alg(
        fr::ResizeAlg::Convolution(fr::FilterType::Bilinear)
    );
    resizer.resize(&src_image, &mut dst_image, &options)?;

    let file = File::create(thumb_path)?;
    let mut writer = BufWriter::new(file);
    let mut encoder = JpegEncoder::new_with_quality(&mut writer, THUMB_QUALITY);
    encoder.encode(
        dst_image.buffer(), target_width, target_height, ExtendedColorType::Rgb8,
    )?;

    Ok((target_width, target_height))
}

fn find_cover_image(folder_path: &Path) -> Option<PathBuf> {
    for &ext in IMAGE_EXTENSIONS {
        let p = folder_path.join(format!("1001.{}", ext));
        if p.exists() { return Some(p); }
        let p_upper = folder_path.join(format!("1001.{}", ext.to_uppercase()));
        if p_upper.exists() { return Some(p_upper); }
    }
    
    let mut fallback_first_name: Option<String> = None;
    let mut fallback_first_path: Option<PathBuf> = None;
    let mut scanned_count = 0; 

    if let Ok(entries) = fs::read_dir(folder_path) {
        for entry in entries.flatten() {
            if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                continue;
            }

            let path = entry.path();
            if is_image_file(&path) {
                scanned_count += 1;
                
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    
                    if stem.ends_with("_p0") {
                        return Some(path);
                    }

                    if scanned_count == 1 {
                        if let Some((prefix, _page_num)) = stem.rsplit_once("_p") {
                            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                                let p0_name = format!("{}_p0.{}", prefix, ext);
                                let p0_path = folder_path.join(p0_name);
                                
                                if p0_path.exists() {
                                    return Some(p0_path); 
                                }
                            }
                        }
                    }
                }

                let name = entry.file_name().to_string_lossy().to_string();
                
                let is_new_min = match &fallback_first_name {
                    None => true,
                    Some(curr) => natord::compare(&name, curr) == std::cmp::Ordering::Less,
                };

                if is_new_min {
                    fallback_first_name = Some(name);
                    fallback_first_path = Some(path);
                }
            }
        }
    }

    fallback_first_path
}

fn generate_video_thumbnail(
    input_path: &Path,
    output_path: &Path,
    sidecar_executable: &Path, 
) -> Result<(), Box<dyn std::error::Error>> {
    let output = Command::new(sidecar_executable)
        .arg(input_path.to_str().ok_or("Invalid input path")?)
        .arg(output_path.to_str().ok_or("Invalid output path")?)
        .output()?;

    if output.status.success() {
        Ok(())
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(format!("Thumb gen failed: {}", err).into())
    }
}

#[tauri::command]
pub fn generate_uuid(input: &str) -> String {
    let namespace = Uuid::parse_str(NAMESPACE).unwrap();
    Uuid::new_v5(&namespace, input.as_bytes()).to_string()
}

#[tauri::command]
pub fn get_library_type(library_path: String) -> Result<String, String> {
    let path = Path::new(&library_path);
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let entry_path = entry.path();
        if entry_path.is_file() {
            if is_video_file(&entry_path) {
                return Ok("video".to_string());
            }
        } else if entry_path.is_dir() {
            if let Ok(entries) = fs::read_dir(entry_path) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if is_book_file(&p) {
                        return Ok("book".to_string());
                    }
                    return Ok("comic".to_string());
                }
            }
        }
    }
    Ok("comic".to_string())
}


#[tauri::command]
pub async fn scan_video_library(
    app: AppHandle,
    library_path: String,
    library_id: String,
) -> Result<Vec<Video>, String> {
    let start = std::time::Instant::now(); // ⏱️ 计时
    let path = Path::new(&library_path);

    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let thumb_dir = cache_dir.join("thumbnails");
    if !thumb_dir.exists() {
        fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;
    }
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let sidecar_path = resource_dir.join("swift").join("video-cover"); 
    
    let sidecar_executable = if sidecar_path.exists() {
        sidecar_path
    } else {
        // Fallback for dev mode when running from project root
        let dev_path = PathBuf::from("src-tauri/swift/video-cover");
        if dev_path.exists() {
            dev_path
        } else {
            PathBuf::from("./swift/video-cover")
        }
    };

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let mut tasks = Vec::new();

    for entry in entries.flatten() {
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        if file_type.is_file() {
            if is_video_file(&entry.path()) {
                tasks.push((entry.path(), entry.path())); 
            }
        } 
    }

    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(4) 
        .build()
        .map_err(|e| e.to_string())?;

    let processed_videos: Vec<Video> = pool.install(|| {
        tasks.par_iter()
            .map(|(video_path, source_entry)| {
                let id = generate_uuid(&video_path.to_string_lossy());
                let title = remove_extension(&source_entry.file_name().unwrap().to_string_lossy());

                let (size, created_at) = if let Ok(metadata) = fs::metadata(video_path) {
                    (metadata.len(), get_created_time(&metadata))
                } else {
                    (0, 0)
                };

                let (starred, deleted) = get_file_tags(video_path);

                let hash = match fs::metadata(video_path) {
                    Ok(m) => get_thumbnail_hash(&m),
                    Err(_) => generate_uuid(&title),
                };
                let thumb_path = thumb_dir.join(format!("{}.jpg", hash));

                if !thumb_path.exists() {
                    let _ = generate_video_thumbnail(video_path, &thumb_path, &sidecar_executable);
                }

                let cover = if thumb_path.exists() {
                    convert_file_src(&thumb_path.to_string_lossy())
                } else {
                    "".to_string()
                };

                let url = convert_file_src(&video_path.to_string_lossy());

                Video {
                    id,
                    title,
                    path: video_path.to_string_lossy().to_string(),
                    url,
                    cover,
                    library_id: library_id.clone(),
                    created_at,
                    size,
                    duration: 0,
                    starred,
                    deleted,
                }
            })
            .collect()
    });

    let mut videos = processed_videos;
    videos.sort_by(|a, b| natord::compare(&a.title, &b.title));

    println!("✅ Scanned {} videos in {:.2}s", videos.len(), start.elapsed().as_secs_f32());
    Ok(videos)
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
                let (starred, deleted) = get_file_tags(&book_path);

                books.push(Book {
                    id: book_id,
                    title,
                    path: book_path.to_string_lossy().to_string(),
                    author_id: author_id.clone(),
                    library_id: library_id.clone(),
                    size,
                    created_at,
                    starred,
                    deleted,
                });
            }
        }

        authors.push(Author {
            id: author_id,
            name: author_name,
            path: author_path.to_string_lossy().to_string(),
            library_id: library_id.clone(),
            book_count: books.len() as u32,
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

    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let thumb_dir = cache_dir.join("thumbnails");
    
    if !thumb_dir.exists() {
        fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;
    }

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let entries_vec: Vec<_> = entries.flatten().collect();

    let processed_comics: Vec<Comic> = entries_vec
        .par_iter()
        .map_init(
            || {
                let decompressor = Decompressor::new().unwrap();
                let resizer = fr::Resizer::new();
                (decompressor, resizer)
            },
            | (decompressor, resizer), entry | {
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

                if let Some(cover_path) = find_cover_image(&comic_path) {
                    if let Ok(cover_meta) = fs::metadata(&cover_path) {
                        let hash = get_thumbnail_hash(&cover_meta);
                        let thumb_path = thumb_dir.join(format!("{}.jpg", hash));

                        if !thumb_path.exists() {
                            let _ = process_and_get_dimensions(
                                &cover_path, 
                                &thumb_path, 
                                decompressor, 
                                resizer
                            );
                        }

                        cover = if thumb_path.exists() {
                            convert_file_src(&thumb_path.to_string_lossy())
                        } else {
                            convert_file_src(&cover_path.to_string_lossy())
                        };
                    }
                }

                let (starred, deleted) = get_file_tags(&comic_path);

                Some(Comic {
                    id: comic_id,
                    title: comic_name,
                    path: comic_path.to_string_lossy().to_string(),
                    cover,
                    library_id: library_id.clone(),
                    created_at,
                    starred,
                    deleted,
                })
            }
        )
        .filter_map(|x| x) 
        .collect();
    
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
        .map_init(
        || {
            let decompressor = Decompressor::new().unwrap(); 
            let resizer = fr::Resizer::new();
            (decompressor, resizer)
        },
        | (decompressor, resizer), file_path | {
            let filename = file_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let hash = match fs::metadata(file_path) {
                Ok(metadata) => get_thumbnail_hash(&metadata),
                Err(_) => {
                    let mut hasher = Sha256::new();
                    hasher.update(file_path.to_string_lossy().as_bytes());
                    format!("{:x}", hasher.finalize())
                }
            };

            let thumb_path = thumb_dir.join(format!("{}.jpg", hash));
            
            let (width, height) = process_and_get_dimensions(
                file_path, 
                &thumb_path, 
                decompressor,
                resizer
            ).unwrap_or_else(|e| {
                eprintln!("⚠️ Failed: {}", e);
                (256, 384)
            });

            let thumbnail = if thumb_path.exists() {
                convert_file_src(&thumb_path.to_string_lossy())
            } else {
                convert_file_src(&file_path.to_string_lossy())
            };

            let (starred, deleted) = get_file_tags(&file_path);

            ComicImage {
                path: file_path.to_string_lossy().to_string(),
                filename,
                url: convert_file_src(&file_path.to_string_lossy()),
                thumbnail,
                width,
                height,
                starred,
                deleted,
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
    
    struct CacheFile {
        path: PathBuf,
        size: u64,
        time_secs: u64,
    }

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

#[tauri::command]
pub fn set_file_tag(path: String, tags: FileTags) -> Result<bool, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("File not found".to_string());
    }
    set_file_tag_impl(p, tags).map_err(|e| e.to_string())?;
    Ok(true)
}