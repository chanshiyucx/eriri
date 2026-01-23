use std::fs;
use std::path::Path;
use tracing::info;

use crate::models::{Author, Book, BookContent, Chapter};
use crate::tags::get_file_tags;

use super::utils::{
    current_time_millis, generate_uuid, get_created_time, is_book_file, is_hidden, remove_extension,
};

fn extract_chapter_title(line: &str) -> Option<String> {
    let trimmed = line.trim();

    const SPECIAL_CHAPTERS: &[&str] = &["序章", "终章", "番外", "后记", "尾声"];
    for &prefix in SPECIAL_CHAPTERS {
        if trimmed.starts_with(prefix) {
            return Some(trimmed.to_string());
        }
    }

    if !trimmed.starts_with('第') {
        return None;
    }

    let chars: Vec<char> = trimmed.chars().collect();
    let mut i = 1;

    // Skip numeric characters (Arabic, fullwidth, or Chinese numerals)
    while i < chars.len() && is_chapter_number_char(chars[i]) {
        i += 1;
    }

    if i == 1 || i >= chars.len() {
        return None;
    }

    const CHAPTER_SUFFIXES: &[char] = &['章', '回', '节', '卷', '集', '幕'];
    if CHAPTER_SUFFIXES.contains(&chars[i]) {
        return Some(trimmed.to_string());
    }

    None
}

fn is_chapter_number_char(c: char) -> bool {
    c.is_ascii_digit()
        || matches!(
            c,
            '一' | '二' | '三' | '四' | '五' | '六' | '七' | '八' | '九' | '十' | '百' | '千'
        )
}

#[tauri::command]
pub fn scan_book_library(library_path: &str, library_id: &str) -> Result<Vec<Author>, String> {
    let start = std::time::Instant::now();
    let path = Path::new(library_path);
    let mut authors = Vec::new();

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let author_path = entry.path();
        if is_hidden(&author_path) || !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            continue;
        }

        let author_name = entry.file_name().to_string_lossy().into_owned();
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
                    path: book_path.to_string_lossy().into_owned(),
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
            path: author_path.to_string_lossy().into_owned(),
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

#[tauri::command]
pub fn parse_book(path: &str) -> Result<BookContent, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("Failed to read file: {e}"))?;

    let lines: Vec<String> = text
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(String::from)
        .collect();

    let mut chapters = Vec::new();

    for (index, line) in lines.iter().enumerate() {
        if let Some(title) = extract_chapter_title(line) {
            chapters.push(Chapter {
                title,
                line_index: index,
            });
        }
    }

    Ok(BookContent { lines, chapters })
}
