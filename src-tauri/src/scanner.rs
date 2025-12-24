use percent_encoding::{utf8_percent_encode, AsciiSet, CONTROLS};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

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
    filename: String,
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
    if let Some(ext) = path.extension() {
        if let Some(ext_str) = ext.to_str() {
            return BOOK_EXTENSIONS.contains(&ext_str.to_lowercase().as_str());
        }
    }
    false
}

fn is_image_file(path: &Path) -> bool {
    if let Some(ext) = path.extension() {
        if let Some(ext_str) = ext.to_str() {
            return IMAGE_EXTENSIONS.contains(&ext_str.to_lowercase().as_str());
        }
    }
    false
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
pub fn scan_comic_library(
    library_path: String,
    library_id: String,
) -> Result<Vec<Comic>, String> {
    let path = Path::new(&library_path);
    let mut comics = Vec::new();

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            continue;
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
                cover = convert_file_src(&path.to_string_lossy());
            }
        }

        comics.push(Comic {
            id: comic_id,
            title: comic_name,
            path: comic_path.to_string_lossy().to_string(),
            cover,
            library_id: library_id.clone(),
            page_count,
            created_at,
        });
    }

    Ok(comics)
}

#[tauri::command]
pub fn scan_comic_images(comic_path: String) -> Result<Vec<ComicImage>, String> {
    let path = Path::new(&comic_path);

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    let mut images: Vec<ComicImage> = entries
        .flatten()
        .filter(|e| {
            e.file_type().map(|ft| ft.is_file()).unwrap_or(false)
                && is_image_file(&e.path())
        })
        .map(|e| ComicImage {
            filename: e.file_name().to_string_lossy().to_string(),
            url: convert_file_src(&e.path().to_string_lossy()),
        })
        .collect();

    images.sort_by(|a, b| natord::compare(&a.filename, &b.filename));

    Ok(images)
}
