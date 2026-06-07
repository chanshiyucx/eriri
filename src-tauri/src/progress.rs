//! Reading progress, owned by the backend.
//!
//! Comic/book progress and favorite chapters live in SQLite, so every browser
//! client shares one source of truth with field-level updates (no whole-blob
//! clobbering across devices). The legacy `progress.json` is migrated once.

use std::collections::HashMap;
use std::sync::Mutex;

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tracing::{info, warn};

use crate::config;

pub struct ProgressDb(pub Mutex<Connection>);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComicProgress {
    pub current: i64,
    pub total: i64,
    pub percent: f64,
    #[serde(rename = "lastRead")]
    pub last_read: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookProgress {
    pub current: i64,
    pub total: i64,
    pub percent: f64,
    #[serde(rename = "lastRead")]
    pub last_read: i64,
    #[serde(rename = "currentChapterTitle", default)]
    pub current_chapter_title: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Snapshot {
    pub comics: HashMap<String, ComicProgress>,
    pub books: HashMap<String, BookProgress>,
    #[serde(rename = "favoriteChapters")]
    pub favorite_chapters: HashMap<String, Vec<i64>>,
}

// --- Setup ---

pub fn init(app: &AppHandle) -> rusqlite::Result<()> {
    let store_dir = config::get_store_dir(app);
    let _ = std::fs::create_dir_all(&store_dir);
    let db_path = store_dir.join("progress.db");

    let conn = Connection::open(&db_path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS comic_progress (
            comic_id   TEXT PRIMARY KEY,
            current    INTEGER NOT NULL,
            total      INTEGER NOT NULL,
            percent    REAL    NOT NULL,
            last_read  INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS book_progress (
            book_id               TEXT PRIMARY KEY,
            current               INTEGER NOT NULL,
            total                 INTEGER NOT NULL,
            percent               REAL    NOT NULL,
            last_read             INTEGER NOT NULL,
            current_chapter_title TEXT
        );
        CREATE TABLE IF NOT EXISTS favorite_chapters (
            book_id    TEXT NOT NULL,
            line_index INTEGER NOT NULL,
            PRIMARY KEY (book_id, line_index)
        );",
    )?;

    migrate_from_json(app, &conn);

    app.manage(ProgressDb(Mutex::new(conn)));
    Ok(())
}

/// One-time import of the legacy `progress.json` blob, only when the DB is empty.
fn migrate_from_json(app: &AppHandle, conn: &Connection) {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM comic_progress", [], |r| r.get(0))
        .unwrap_or(0);
    let book_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM book_progress", [], |r| r.get(0))
        .unwrap_or(0);
    if count > 0 || book_count > 0 {
        return;
    }

    let Some(raw) = config::read_store_data(app.clone(), "progress".to_string()) else {
        return;
    };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return;
    };
    let Some(state) = value.get("state") else {
        return;
    };

    let mut imported = 0usize;

    if let Some(comics) = state.get("comics").and_then(|v| v.as_object()) {
        for (id, p) in comics {
            if let Ok(progress) = serde_json::from_value::<ComicProgress>(p.clone())
                && upsert_comic(conn, id, &progress).is_ok()
            {
                imported += 1;
            }
        }
    }
    if let Some(books) = state.get("books").and_then(|v| v.as_object()) {
        for (id, p) in books {
            if let Ok(progress) = serde_json::from_value::<BookProgress>(p.clone())
                && upsert_book(conn, id, &progress).is_ok()
            {
                imported += 1;
            }
        }
    }
    if let Some(favs) = state.get("favoriteChapters").and_then(|v| v.as_object()) {
        for (id, lines) in favs {
            if let Ok(list) = serde_json::from_value::<Vec<i64>>(lines.clone()) {
                let _ = set_favorites(conn, id, &list);
            }
        }
    }

    if imported > 0 {
        info!(
            records = imported,
            "Migrated reading progress from progress.json"
        );
    } else {
        warn!("No legacy progress found to migrate");
    }
}

// --- Data access (operate on a borrowed connection) ---

pub fn get_snapshot(conn: &Connection) -> rusqlite::Result<Snapshot> {
    let mut comics = HashMap::new();
    {
        let mut stmt = conn
            .prepare("SELECT comic_id, current, total, percent, last_read FROM comic_progress")?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                ComicProgress {
                    current: row.get(1)?,
                    total: row.get(2)?,
                    percent: row.get(3)?,
                    last_read: row.get(4)?,
                },
            ))
        })?;
        for row in rows {
            let (id, p) = row?;
            comics.insert(id, p);
        }
    }

    let mut books = HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT book_id, current, total, percent, last_read, current_chapter_title FROM book_progress",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                BookProgress {
                    current: row.get(1)?,
                    total: row.get(2)?,
                    percent: row.get(3)?,
                    last_read: row.get(4)?,
                    current_chapter_title: row.get(5)?,
                },
            ))
        })?;
        for row in rows {
            let (id, p) = row?;
            books.insert(id, p);
        }
    }

    let mut favorite_chapters: HashMap<String, Vec<i64>> = HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT book_id, line_index FROM favorite_chapters ORDER BY book_id, line_index",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;
        for row in rows {
            let (id, line) = row?;
            favorite_chapters.entry(id).or_default().push(line);
        }
    }

    Ok(Snapshot {
        comics,
        books,
        favorite_chapters,
    })
}

pub fn upsert_comic(conn: &Connection, id: &str, p: &ComicProgress) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO comic_progress (comic_id, current, total, percent, last_read)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(comic_id) DO UPDATE SET
            current = excluded.current,
            total = excluded.total,
            percent = excluded.percent,
            last_read = excluded.last_read",
        params![id, p.current, p.total, p.percent, p.last_read],
    )?;
    Ok(())
}

pub fn delete_comic(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM comic_progress WHERE comic_id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn upsert_book(conn: &Connection, id: &str, p: &BookProgress) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO book_progress (book_id, current, total, percent, last_read, current_chapter_title)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(book_id) DO UPDATE SET
            current = excluded.current,
            total = excluded.total,
            percent = excluded.percent,
            last_read = excluded.last_read,
            current_chapter_title = excluded.current_chapter_title",
        params![
            id,
            p.current,
            p.total,
            p.percent,
            p.last_read,
            p.current_chapter_title
        ],
    )?;
    Ok(())
}

pub fn delete_book(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM book_progress WHERE book_id = ?1", params![id])?;
    Ok(())
}

/// Replace the full favorite-chapter set for a book (idempotent).
pub fn set_favorites(conn: &Connection, book_id: &str, lines: &[i64]) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM favorite_chapters WHERE book_id = ?1",
        params![book_id],
    )?;
    for &line in lines {
        tx.execute(
            "INSERT OR IGNORE INTO favorite_chapters (book_id, line_index) VALUES (?1, ?2)",
            params![book_id, line],
        )?;
    }
    tx.commit()
}

pub fn delete_favorites(conn: &Connection, book_id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM favorite_chapters WHERE book_id = ?1",
        params![book_id],
    )?;
    Ok(())
}
