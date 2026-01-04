use std::fs;
use std::path::Path;
use tracing::info;

use crate::models::{Author, Book};
use crate::tags::get_file_tags;

use super::utils::{
    current_time_millis, generate_uuid, get_created_time, is_book_file, is_hidden, remove_extension,
};

/// Scan book library and return authors with their books
#[tauri::command]
pub fn scan_book_library(
    library_path: &str,
    library_id: &str,
) -> Result<Vec<Author>, String> {
    let start = std::time::Instant::now();
    let path = Path::new(library_path);
    let mut authors = Vec::new();

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let author_path = entry.path();
        if is_hidden(&author_path) || !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            continue;
        }

        let author_name = entry.file_name().to_string_lossy().to_string();
        let author_id = generate_uuid(&author_path.to_string_lossy());

        let mut books = Vec::new();

        if let Ok(author_entries) = fs::read_dir(&author_path) {
            for book_entry in author_entries.flatten() {
                let book_path = book_entry.path();
                if is_hidden(&book_path) || !is_book_file(&book_path) {
                    continue;
                }

                let book_id = generate_uuid(&book_path.to_string_lossy());
                let title = remove_extension(&book_entry.file_name().to_string_lossy());

                let (size, created_at) = book_entry
                    .metadata()
                    .map(|m| (m.len(), get_created_time(&m)))
                    .unwrap_or((0, current_time_millis()));

                let (starred, deleted) = get_file_tags(&book_path);

                books.push(Book {
                    id: book_id,
                    title,
                    path: book_path.to_string_lossy().to_string(),
                    author_id: author_id.clone(),
                    library_id: library_id.to_string(),
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
            library_id: library_id.to_string(),
            book_count: u32::try_from(books.len()).unwrap_or(u32::MAX),
            books,
        });
    }

    info!(
        authors = authors.len(),
        duration_ms = u64::try_from(start.elapsed().as_millis()).unwrap_or(u64::MAX),
        "Scanned book library"
    );

    Ok(authors)
}
