//! Library catalog, owned by the backend.
//!
//! Imported libraries and their scanned contents live in SQLite; clients
//! hydrate a read-only mirror and drive mutations over the HTTP API. Tags
//! (starred / deleted) stay sourced from macOS file xattr — the DB only mirrors
//! them.

use std::sync::Mutex;

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tracing::{info, warn};

use crate::config;
use crate::models::{Author, Book, Comic, FileTags};

pub struct LibraryDb(pub Mutex<Connection>);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Library {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "sortOrder")]
    pub sort_order: i64,
}

/// Flat author row (no nested books) for the catalog snapshot.
#[derive(Debug, Serialize)]
pub struct AuthorRow {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "libraryId")]
    pub library_id: String,
    #[serde(rename = "bookCount")]
    pub book_count: u32,
}

#[derive(Debug, Serialize)]
pub struct Catalog {
    pub libraries: Vec<Library>,
    pub comics: Vec<Comic>,
    pub authors: Vec<AuthorRow>,
    pub books: Vec<Book>,
}

// --- Setup ---

pub fn init(app: &AppHandle) -> rusqlite::Result<()> {
    let store_dir = config::get_store_dir(app);
    let _ = std::fs::create_dir_all(&store_dir);
    let db_path = store_dir.join("library.db");

    let conn = Connection::open(&db_path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS libraries (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            path       TEXT NOT NULL,
            type       TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            sort_order INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS comics (
            id         TEXT PRIMARY KEY,
            title      TEXT NOT NULL,
            path       TEXT NOT NULL,
            cover      TEXT NOT NULL,
            library_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            starred    INTEGER NOT NULL,
            deleted    INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS authors (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            path       TEXT NOT NULL,
            library_id TEXT NOT NULL,
            book_count INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS books (
            id         TEXT PRIMARY KEY,
            title      TEXT NOT NULL,
            path       TEXT NOT NULL,
            author_id  TEXT NOT NULL,
            library_id TEXT NOT NULL,
            size       INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            starred    INTEGER NOT NULL,
            deleted    INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_comics_library ON comics(library_id);
        CREATE INDEX IF NOT EXISTS idx_authors_library ON authors(library_id);
        CREATE INDEX IF NOT EXISTS idx_books_author ON books(author_id);",
    )?;

    // Migrate legacy `asset://localhost/<enc>` covers to `/file?path=<enc>`
    // (the encoded path is identical, only the prefix changed).
    let _ = conn.execute(
        "UPDATE comics SET cover = '/file?path=' || substr(cover, 19) \
         WHERE cover LIKE 'asset://localhost/%'",
        [],
    );

    migrate_from_json(app, &conn);

    app.manage(LibraryDb(Mutex::new(conn)));
    Ok(())
}

/// One-time import of the legacy `library.json` blob, only when the DB is empty.
fn migrate_from_json(app: &AppHandle, conn: &Connection) {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM libraries", [], |r| r.get(0))
        .unwrap_or(0);
    if count > 0 {
        return;
    }

    let Some(raw) = config::read_store_data(app.clone(), "library".to_string()) else {
        return;
    };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return;
    };
    let Some(state) = value.get("state") else {
        return;
    };

    let mut libs = 0usize;

    if let Some(libraries) = state.get("libraries").and_then(|v| v.as_object()) {
        for lib in libraries.values() {
            if let Ok(library) = serde_json::from_value::<Library>(lib.clone())
                && upsert_library(conn, &library).is_ok()
            {
                libs += 1;
            }
        }
    }
    if let Some(comics) = state.get("comics").and_then(|v| v.as_object()) {
        for c in comics.values() {
            if let Ok(comic) = serde_json::from_value::<Comic>(c.clone()) {
                let _ = upsert_comic(conn, &comic);
            }
        }
    }
    if let Some(authors) = state.get("authors").and_then(|v| v.as_object()) {
        for a in authors.values() {
            if let Ok(author) = serde_json::from_value::<Author>(a.clone()) {
                let _ = upsert_author(conn, &author);
            }
        }
    }
    if let Some(books) = state.get("books").and_then(|v| v.as_object()) {
        for b in books.values() {
            if let Ok(book) = serde_json::from_value::<Book>(b.clone()) {
                let _ = upsert_book(conn, &book);
            }
        }
    }

    if libs > 0 {
        info!(
            libraries = libs,
            "Migrated library catalog from library.json"
        );
    } else {
        warn!("No legacy library catalog found to migrate");
    }
}

// --- Row helpers ---

fn upsert_library(conn: &Connection, lib: &Library) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO libraries (id, name, path, type, created_at, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name, path = excluded.path, type = excluded.type,
            created_at = excluded.created_at, sort_order = excluded.sort_order",
        params![
            lib.id,
            lib.name,
            lib.path,
            lib.type_,
            lib.created_at,
            lib.sort_order
        ],
    )?;
    Ok(())
}

fn upsert_comic(conn: &Connection, c: &Comic) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO comics (id, title, path, cover, library_id, created_at, starred, deleted)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
            title = excluded.title, path = excluded.path, cover = excluded.cover,
            library_id = excluded.library_id, created_at = excluded.created_at,
            starred = excluded.starred, deleted = excluded.deleted",
        params![
            c.id,
            c.title,
            c.path,
            c.cover,
            c.library_id,
            c.created_at as i64,
            c.starred as i64,
            c.deleted as i64
        ],
    )?;
    Ok(())
}

fn upsert_author(conn: &Connection, a: &Author) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO authors (id, name, path, library_id, book_count)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name, path = excluded.path,
            library_id = excluded.library_id, book_count = excluded.book_count",
        params![a.id, a.name, a.path, a.library_id, a.book_count as i64],
    )?;
    Ok(())
}

fn upsert_book(conn: &Connection, b: &Book) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO books (id, title, path, author_id, library_id, size, created_at, starred, deleted)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(id) DO UPDATE SET
            title = excluded.title, path = excluded.path, author_id = excluded.author_id,
            library_id = excluded.library_id, size = excluded.size,
            created_at = excluded.created_at, starred = excluded.starred, deleted = excluded.deleted",
        params![
            b.id,
            b.title,
            b.path,
            b.author_id,
            b.library_id,
            b.size as i64,
            b.created_at as i64,
            b.starred as i64,
            b.deleted as i64
        ],
    )?;
    Ok(())
}

/// Replace all scanned content for one library (comics + authors + books).
fn replace_library_content(
    conn: &Connection,
    library_id: &str,
    comics: &[Comic],
    authors: &[Author],
) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM comics WHERE library_id = ?1",
        params![library_id],
    )?;
    tx.execute(
        "DELETE FROM books WHERE library_id = ?1",
        params![library_id],
    )?;
    tx.execute(
        "DELETE FROM authors WHERE library_id = ?1",
        params![library_id],
    )?;

    for comic in comics {
        upsert_comic(&tx, comic)?;
    }
    for author in authors {
        upsert_author(&tx, author)?;
        for book in &author.books {
            upsert_book(&tx, book)?;
        }
    }
    tx.commit()
}

// --- Catalog read ---

pub fn get_catalog(conn: &Connection) -> rusqlite::Result<Catalog> {
    let libraries = {
        let mut stmt = conn.prepare(
            "SELECT id, name, path, type, created_at, sort_order
             FROM libraries ORDER BY sort_order",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Library {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                type_: row.get(3)?,
                created_at: row.get(4)?,
                sort_order: row.get(5)?,
            })
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };

    let comics = {
        let mut stmt = conn.prepare(
            "SELECT id, title, path, cover, library_id, created_at, starred, deleted FROM comics",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Comic {
                id: row.get(0)?,
                title: row.get(1)?,
                path: row.get(2)?,
                cover: row.get(3)?,
                library_id: row.get(4)?,
                created_at: row.get::<_, i64>(5)? as u64,
                starred: row.get::<_, i64>(6)? != 0,
                deleted: row.get::<_, i64>(7)? != 0,
            })
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };

    let authors = {
        let mut stmt =
            conn.prepare("SELECT id, name, path, library_id, book_count FROM authors")?;
        let rows = stmt.query_map([], |row| {
            Ok(AuthorRow {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                library_id: row.get(3)?,
                book_count: row.get::<_, i64>(4)? as u32,
            })
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };

    let books = {
        let mut stmt = conn.prepare(
            "SELECT id, title, path, author_id, library_id, size, created_at, starred, deleted FROM books",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Book {
                id: row.get(0)?,
                title: row.get(1)?,
                path: row.get(2)?,
                author_id: row.get(3)?,
                library_id: row.get(4)?,
                size: row.get::<_, i64>(5)? as u64,
                created_at: row.get::<_, i64>(6)? as u64,
                starred: row.get::<_, i64>(7)? != 0,
                deleted: row.get::<_, i64>(8)? != 0,
            })
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };

    Ok(Catalog {
        libraries,
        comics,
        authors,
        books,
    })
}

// --- Mutations (scan + persist). These do filesystem + DB work. ---

/// Import a new library at `path`: detect type, scan, and persist. Returns the
/// new library's id (caller re-hydrates).
pub fn import(app: &AppHandle, path: &str) -> Result<String, String> {
    let id = crate::scanner::utils::generate_uuid(path);

    {
        let state = app.state::<LibraryDb>();
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let exists: bool = conn
            .query_row("SELECT 1 FROM libraries WHERE id = ?1", params![id], |_| {
                Ok(true)
            })
            .unwrap_or(false);
        if exists {
            return Ok(id);
        }
    }

    let type_ = crate::scanner::utils::get_library_type(path)?;
    let name = path
        .rsplit('/')
        .next()
        .unwrap_or("Untitled Library")
        .to_string();

    let sort_order = {
        let state = app.state::<LibraryDb>();
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM libraries",
            [],
            |r| r.get::<_, i64>(0),
        )
        .unwrap_or(1)
    };

    let (comics, authors) = scan(app, path, &id, &type_)?;

    let library = Library {
        id: id.clone(),
        name,
        path: path.to_string(),
        type_,
        created_at: crate::scanner::utils::current_time_millis() as i64,
        sort_order,
    };

    let state = app.state::<LibraryDb>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    upsert_library(&conn, &library).map_err(|e| e.to_string())?;
    replace_library_content(&conn, &id, &comics, &authors).map_err(|e| e.to_string())?;
    Ok(id)
}

/// Re-scan an existing library and replace its content. Bumps `created_at`
/// so the frontend remounts the view.
pub fn refresh(app: &AppHandle, id: &str) -> Result<(), String> {
    let (path, type_) = {
        let state = app.state::<LibraryDb>();
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT path, type FROM libraries WHERE id = ?1",
            params![id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|e| e.to_string())?
    };

    let (comics, authors) = scan(app, &path, id, &type_)?;

    let state = app.state::<LibraryDb>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    replace_library_content(&conn, id, &comics, &authors).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE libraries SET created_at = ?2 WHERE id = ?1",
        params![id, crate::scanner::utils::current_time_millis() as i64],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn scan(
    app: &AppHandle,
    path: &str,
    id: &str,
    type_: &str,
) -> Result<(Vec<Comic>, Vec<Author>), String> {
    if type_ == "book" {
        let authors = crate::scanner::book::scan_book_library(path, id)?;
        Ok((Vec::new(), authors))
    } else {
        let comics = crate::scanner::comic::scan_comic_library(app.clone(), path, id)?;
        Ok((comics, Vec::new()))
    }
}

pub fn remove(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM comics WHERE library_id = ?1", params![id])?;
    conn.execute("DELETE FROM books WHERE library_id = ?1", params![id])?;
    conn.execute("DELETE FROM authors WHERE library_id = ?1", params![id])?;
    conn.execute("DELETE FROM libraries WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn reorder(conn: &Connection, ordered_ids: &[String]) -> rusqlite::Result<()> {
    for (index, id) in ordered_ids.iter().enumerate() {
        conn.execute(
            "UPDATE libraries SET sort_order = ?2 WHERE id = ?1",
            params![id, index as i64],
        )?;
    }
    Ok(())
}

/// Write tags to the file (xattr) and mirror them on the catalog row.
pub fn set_comic_tags(app: &AppHandle, id: &str, tags: &FileTags) -> Result<(), String> {
    let path: String = {
        let state = app.state::<LibraryDb>();
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.query_row("SELECT path FROM comics WHERE id = ?1", params![id], |r| {
            r.get(0)
        })
        .map_err(|e| e.to_string())?
    };

    crate::tags::set_file_tag_impl(std::path::Path::new(&path), *tags)
        .map_err(|e| e.to_string())?;

    let state = app.state::<LibraryDb>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(starred) = tags.starred {
        conn.execute(
            "UPDATE comics SET starred = ?2 WHERE id = ?1",
            params![id, starred as i64],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(deleted) = tags.deleted {
        conn.execute(
            "UPDATE comics SET deleted = ?2 WHERE id = ?1",
            params![id, deleted as i64],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn set_book_tags(app: &AppHandle, id: &str, tags: &FileTags) -> Result<(), String> {
    let path: String = {
        let state = app.state::<LibraryDb>();
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.query_row("SELECT path FROM books WHERE id = ?1", params![id], |r| {
            r.get(0)
        })
        .map_err(|e| e.to_string())?
    };

    crate::tags::set_file_tag_impl(std::path::Path::new(&path), *tags)
        .map_err(|e| e.to_string())?;

    let state = app.state::<LibraryDb>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(starred) = tags.starred {
        conn.execute(
            "UPDATE books SET starred = ?2 WHERE id = ?1",
            params![id, starred as i64],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(deleted) = tags.deleted {
        conn.execute(
            "UPDATE books SET deleted = ?2 WHERE id = ?1",
            params![id, deleted as i64],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// --- Menu helpers ---

/// (id, name, path) for every library, ordered, for the tray menu.
pub fn list_for_menu(app: &AppHandle) -> Vec<(String, String, String)> {
    let state = app.state::<LibraryDb>();
    let Ok(conn) = state.0.lock() else {
        return Vec::new();
    };
    let Ok(mut stmt) = conn.prepare("SELECT id, name, path FROM libraries ORDER BY sort_order")
    else {
        return Vec::new();
    };
    stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })
    .map(|rows| rows.flatten().collect())
    .unwrap_or_default()
}

pub fn library_path(app: &AppHandle, id: &str) -> Option<String> {
    let state = app.state::<LibraryDb>();
    let conn = state.0.lock().ok()?;
    conn.query_row(
        "SELECT path FROM libraries WHERE id = ?1",
        params![id],
        |r| r.get::<_, String>(0),
    )
    .ok()
}
