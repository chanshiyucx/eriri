use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::Path;
#[cfg(not(coverage))]
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
            '０' | '１'
                | '２'
                | '３'
                | '４'
                | '５'
                | '６'
                | '７'
                | '８'
                | '９'
                | '一'
                | '二'
                | '三'
                | '四'
                | '五'
                | '六'
                | '七'
                | '八'
                | '九'
                | '十'
                | '百'
                | '千'
        )
}

pub fn scan_book_library(library_path: &str, library_id: &str) -> Result<Vec<Author>, String> {
    #[cfg(not(coverage))]
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

    #[cfg(not(coverage))]
    info!(
        authors = authors.len(),
        duration_ms = u64::try_from(start.elapsed().as_millis()).unwrap_or(u64::MAX),
        "Scanned book library"
    );

    Ok(authors)
}

pub fn parse_book(path: &str) -> Result<BookContent, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open file: {e}"))?;
    let reader = BufReader::new(file);
    let mut lines = Vec::new();
    let mut chapters = Vec::new();

    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed to read file: {e}"))?;
        if line.trim().is_empty() {
            continue;
        }

        if let Some(title) = extract_chapter_title(&line) {
            chapters.push(Chapter {
                title,
                line_index: lines.len(),
            });
        }

        lines.push(line);
    }

    Ok(BookContent { lines, chapters })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn parse_book_ignores_blank_lines_and_detects_chapters() {
        let mut file = tempfile::NamedTempFile::new().expect("create temp book");
        write!(
            file,
            "\n序章\n开场\n\n第一章 开始\n正文一\n第２章 全角数字\n正文二\n尾声\n"
        )
        .expect("write temp book");

        let content =
            parse_book(file.path().to_str().expect("temp path is utf-8")).expect("parse temp book");

        assert_eq!(
            content.lines,
            vec![
                "序章",
                "开场",
                "第一章 开始",
                "正文一",
                "第２章 全角数字",
                "正文二",
                "尾声",
            ]
        );
        assert_eq!(
            content
                .chapters
                .iter()
                .map(|chapter| (chapter.title.as_str(), chapter.line_index))
                .collect::<Vec<_>>(),
            vec![
                ("序章", 0),
                ("第一章 开始", 2),
                ("第２章 全角数字", 4),
                ("尾声", 6),
            ]
        );
    }

    #[test]
    fn scan_book_library_discovers_authors_and_text_books() {
        let library_dir = tempfile::tempdir().expect("create temp library");
        fs::write(library_dir.path().join("not-an-author.txt"), "skip").expect("write top file");
        fs::create_dir(library_dir.path().join(".hidden-author"))
            .expect("create hidden author dir");
        let author_dir = library_dir.path().join("Author 1");
        fs::create_dir(&author_dir).expect("create author dir");
        fs::write(author_dir.join("Book 1.txt"), "第一章\n正文").expect("write book");
        fs::write(author_dir.join(".hidden.txt"), "hidden").expect("write hidden book");
        fs::write(author_dir.join("notes.md"), "not a book").expect("write non-book");

        let authors = scan_book_library(
            library_dir.path().to_str().expect("library path is utf-8"),
            "library-1",
        )
        .expect("scan book library");

        assert_eq!(authors.len(), 1);
        assert_eq!(authors[0].name, "Author 1");
        assert_eq!(authors[0].book_count, 1);
        assert_eq!(authors[0].books[0].title, "Book 1");
        assert_eq!(authors[0].books[0].library_id, "library-1");
    }

    #[cfg(unix)]
    #[test]
    fn scan_book_library_keeps_unreadable_authors_as_empty() {
        use std::os::unix::fs::PermissionsExt;

        let library_dir = tempfile::tempdir().expect("create temp library");
        let author_dir = library_dir.path().join("Unreadable Author");
        fs::create_dir(&author_dir).expect("create unreadable author dir");
        fs::write(author_dir.join("Book 1.txt"), "第一章\n正文").expect("write book");
        let original_permissions = fs::metadata(&author_dir)
            .expect("read author metadata")
            .permissions();
        fs::set_permissions(&author_dir, fs::Permissions::from_mode(0o000))
            .expect("make author dir unreadable");

        assert!(
            fs::read_dir(&author_dir).is_err(),
            "test requires an unprivileged user that cannot read mode-000 directories"
        );

        let authors = scan_book_library(
            library_dir.path().to_str().expect("library path is utf-8"),
            "library-1",
        )
        .expect("scan library with unreadable author");

        fs::set_permissions(&author_dir, original_permissions).expect("restore author dir");

        assert_eq!(authors.len(), 1);
        assert_eq!(authors[0].name, "Unreadable Author");
        assert_eq!(authors[0].book_count, 0);
        assert!(authors[0].books.is_empty());
    }

    #[test]
    fn parse_book_rejects_missing_files() {
        let missing = tempfile::tempdir()
            .expect("create temp dir")
            .path()
            .join("missing.txt");

        let error = parse_book(missing.to_str().expect("path is utf-8"))
            .expect_err("missing book should fail");

        assert!(error.starts_with("Failed to open file:"));
    }

    #[test]
    fn parse_book_ignores_lines_that_are_not_chapter_titles() {
        let mut file = tempfile::NamedTempFile::new().expect("create temp book");
        write!(
            file,
            "第章 缺少数字\n第一话 不支持后缀\n第十章 正文\n正文\n"
        )
        .expect("write temp book");

        let content =
            parse_book(file.path().to_str().expect("path is utf-8")).expect("parse temp book");

        assert_eq!(
            content
                .chapters
                .iter()
                .map(|chapter| chapter.title.as_str())
                .collect::<Vec<_>>(),
            vec!["第十章 正文"]
        );
    }
}
