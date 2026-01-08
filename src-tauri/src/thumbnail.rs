use fast_image_resize as fr;
use image::codecs::jpeg::JpegEncoder;
use image::{ExtendedColorType, ImageReader};
use memmap2::Mmap;
use percent_encoding::utf8_percent_encode;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{BufReader, BufWriter};
use std::num::NonZeroU32;
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;
use tauri::{AppHandle, Manager};
use tracing::info;
use turbojpeg::{Decompressor, Image, PixelFormat, ScalingFactor};

use crate::config;

pub const THUMB_WIDTH: u32 = 256;
pub const THUMB_HEIGHT: u32 = 384;
const THUMB_QUALITY: u8 = 70;

// URL encoding set for asset protocol
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

pub const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png"];

pub fn get_thumbnail_dir(app: &AppHandle) -> PathBuf {
    let config = config::get(app);
    let base_path = if let Some(custom_path) = config.cache_dir {
        PathBuf::from(custom_path)
    } else {
        app.path()
            .app_cache_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
    };

    let thumb_dir = base_path.join("thumbnail");

    if !thumb_dir.exists() {
        let _ = fs::create_dir_all(&thumb_dir);
    }

    thumb_dir
}

fn is_jpeg(data: &[u8]) -> bool {
    data.len() >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF
}

pub fn get_thumbnail_hash(metadata: &fs::Metadata) -> String {
    let mut hasher = Sha256::new();
    hasher.update(metadata.ino().to_le_bytes());
    hasher.update(metadata.len().to_le_bytes());
    hasher.update(metadata.mtime().to_le_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn is_image_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext_str| IMAGE_EXTENSIONS.iter().any(|&x| x.eq_ignore_ascii_case(ext_str)))
}

pub fn get_image_dimensions_fast(path: &Path) -> Result<(u32, u32), Box<dyn std::error::Error>> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let reader = ImageReader::new(reader).with_guessed_format()?;
    let (width, height) = reader.into_dimensions()?;
    Ok((width, height))
}

pub fn process_and_get_dimensions(
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
        // Fast JPEG decoding with turbojpeg
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

        let scaled_width = (header.width * num).div_ceil(denom);
        let scaled_height = (header.height * num).div_ceil(denom);

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
        resize_and_save(
            pixels,
            scaled_width as u32,
            scaled_height as u32,
            orig_width,
            orig_height,
            thumb_path,
            resizer,
        )
    } else {
        // Standard image decoding for PNG and other formats
        let reader = ImageReader::new(std::io::Cursor::new(&mmap[..]))
            .with_guessed_format()?;
        let img = reader.decode()?;
        let (width, height) = (img.width(), img.height());

        resize_and_save(
            img.into_rgb8().into_raw(),
            width,
            height,
            width,
            height,
            thumb_path,
            resizer,
        )
    }
}

fn resize_and_save(
    src_pixels: Vec<u8>,
    src_w: u32,
    src_h: u32,
    orig_w: u32,
    orig_h: u32,
    thumb_path: &Path,
    resizer: &mut fr::Resizer,
) -> Result<(u32, u32), Box<dyn std::error::Error>> {
    let target_width = THUMB_WIDTH;
    let target_height = (orig_h as f64 * (target_width as f64 / orig_w as f64)) as u32;

    let src_width = NonZeroU32::new(src_w).ok_or("Src width is 0")?;
    let src_height = NonZeroU32::new(src_h).ok_or("Src height is 0")?;
    let src_image = fr::images::Image::from_vec_u8(
        src_width.get(),
        src_height.get(),
        src_pixels,
        fr::PixelType::U8x3,
    )?;

    let dst_width = NonZeroU32::new(target_width).ok_or("Dst width is 0")?;
    let dst_height = NonZeroU32::new(target_height).ok_or("Dst height is 0")?;
    let mut dst_image = fr::images::Image::new(
        dst_width.get(),
        dst_height.get(),
        src_image.pixel_type(),
    );

    let options = fr::ResizeOptions::new().resize_alg(
        fr::ResizeAlg::Convolution(fr::FilterType::Bilinear)
    );
    resizer.resize(&src_image, &mut dst_image, &options)?;

    let file = File::create(thumb_path)?;
    let mut writer = BufWriter::new(file);
    let mut encoder = JpegEncoder::new_with_quality(&mut writer, THUMB_QUALITY);
    encoder.encode(
        dst_image.buffer(),
        target_width,
        target_height,
        ExtendedColorType::Rgb8,
    )?;

    Ok((target_width, target_height))
}

pub fn find_cover_image(folder_path: &Path) -> Option<PathBuf> {
    // Try to find 1001.jpg/png first (common cover naming)
    for &ext in IMAGE_EXTENSIONS {
        let p = folder_path.join(format!("1001.{ext}"));
        if p.exists() {
            return Some(p);
        }
        let upper_ext = ext.to_uppercase();
        let p_upper = folder_path.join(format!("1001.{upper_ext}"));
        if p_upper.exists() {
            return Some(p_upper);
        }
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
                    // Check for _p0 suffix (page 0)
                    if stem.ends_with("_p0") {
                        return Some(path);
                    }

                    // On first image, check if _p0 variant exists
                    if scanned_count == 1 {
                        if let Some((prefix, _page_num)) = stem.rsplit_once("_p") {
                            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                                let p0_name = format!("{prefix}_p0.{ext}");
                                let p0_path = folder_path.join(p0_name);

                                if p0_path.exists() {
                                    return Some(p0_path);
                                }
                            }
                        }
                    }
                }

                // Track the first image by natural sort order
                let name = entry.file_name().to_string_lossy().into_owned();

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

pub fn generate_video_thumbnail(
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
        Err(format!("Thumb gen failed: {err}").into())
    }
}

pub fn convert_file_src(path: &str) -> String {
    let encoded_path = utf8_percent_encode(path, &ENCODE_SET).to_string();
    format!("asset://localhost/{encoded_path}")
}

#[tauri::command]
pub async fn clean_thumbnail_cache(
    app: AppHandle,
    days_old: Option<u64>,
    max_size_mb: Option<u64>,
) -> Result<(usize, u64), String> {
    let days = days_old.unwrap_or(30);
    let max_size = max_size_mb.unwrap_or(1024) * 1024 * 1024;

    let thumb_dir = get_thumbnail_dir(&app);

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
                if !metadata.is_file() {
                    continue;
                }

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

    // If still over size limit, delete oldest files
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

    info!(
        deleted = deleted_count,
        freed_mb = freed_bytes as f64 / 1024.0 / 1024.0,
        "Cleaned thumbnail cache"
    );

    Ok((deleted_count, freed_bytes))
}

#[tauri::command]
pub fn get_thumbnail_stats(app: AppHandle) -> Result<(usize, u64), String> {
    let thumb_dir = get_thumbnail_dir(&app);

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
pub fn get_cache_dir(app: AppHandle) -> Option<String> {
    config::get(&app).cache_dir
}

#[tauri::command]
pub fn set_cache_dir(app: AppHandle, path: String) -> Result<(), String> {
    let mut config = config::get(&app);
    config.cache_dir = Some(path);
    config::save_config(&app, &config)
}
