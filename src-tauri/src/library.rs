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

const LIBRARY_SCHEMA: &str = "CREATE TABLE IF NOT EXISTS libraries (
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
    CREATE INDEX IF NOT EXISTS idx_books_author ON books(author_id);";

const UPSERT_LIBRARY_SQL: &str =
    "INSERT INTO libraries (id, name, path, type, created_at, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name, path = excluded.path, type = excluded.type,
            created_at = excluded.created_at, sort_order = excluded.sort_order";

const UPSERT_COMIC_SQL: &str =
    "INSERT INTO comics (id, title, path, cover, library_id, created_at, starred, deleted)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
            title = excluded.title, path = excluded.path, cover = excluded.cover,
            library_id = excluded.library_id, created_at = excluded.created_at,
            starred = excluded.starred, deleted = excluded.deleted";

const UPSERT_AUTHOR_SQL: &str = "INSERT INTO authors (id, name, path, library_id, book_count)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name, path = excluded.path,
            library_id = excluded.library_id, book_count = excluded.book_count";

const UPSERT_BOOK_SQL: &str =
    "INSERT INTO books (id, title, path, author_id, library_id, size, created_at, starred, deleted)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(id) DO UPDATE SET
            title = excluded.title, path = excluded.path, author_id = excluded.author_id,
            library_id = excluded.library_id, size = excluded.size,
            created_at = excluded.created_at, starred = excluded.starred, deleted = excluded.deleted";

// --- Setup ---

pub fn init(app: &AppHandle) -> rusqlite::Result<()> {
    let conn = open_db(app)?;
    app.manage(LibraryDb(Mutex::new(conn)));
    Ok(())
}

/// Re-open the library DB against the *current* store directory and swap it into
/// the live `LibraryDb` state. Called after the cache directory changes so the
/// resource library reflects the new directory's `store/library.db` without a
/// restart. The frontend re-hydrates on focus.
pub fn reopen(app: &AppHandle) -> rusqlite::Result<()> {
    let conn = open_db(app)?;
    let state = app.state::<LibraryDb>();
    // A poisoned lock is fine here: we replace the connection wholesale.
    let mut guard = state.0.lock().unwrap_or_else(|e| e.into_inner());
    *guard = conn;
    Ok(())
}

/// Open (and initialize) the SQLite connection at `<store_dir>/library.db`.
fn open_db(app: &AppHandle) -> rusqlite::Result<Connection> {
    let store_dir = config::get_store_dir(app);
    let _ = std::fs::create_dir_all(&store_dir);
    let db_path = store_dir.join("library.db");

    let conn = Connection::open(&db_path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.execute_batch(LIBRARY_SCHEMA)?;

    // Migrate legacy `asset://localhost/<enc>` covers to `/file?path=<enc>`
    // (the encoded path is identical, only the prefix changed).
    let _ = conn.execute(
        "UPDATE comics SET cover = '/file?path=' || substr(cover, 19) \
         WHERE cover LIKE 'asset://localhost/%'",
        [],
    );

    migrate_from_json(app, &conn);

    Ok(conn)
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
        UPSERT_LIBRARY_SQL,
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
        UPSERT_COMIC_SQL,
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
        UPSERT_AUTHOR_SQL,
        params![a.id, a.name, a.path, a.library_id, a.book_count as i64],
    )?;
    Ok(())
}

fn upsert_book(conn: &Connection, b: &Book) -> rusqlite::Result<()> {
    conn.execute(
        UPSERT_BOOK_SQL,
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

    {
        let mut stmt = tx.prepare_cached(UPSERT_COMIC_SQL)?;
        for c in comics {
            stmt.execute(params![
                c.id,
                c.title,
                c.path,
                c.cover,
                c.library_id,
                c.created_at as i64,
                c.starred as i64,
                c.deleted as i64
            ])?;
        }
    }

    {
        let mut author_stmt = tx.prepare_cached(UPSERT_AUTHOR_SQL)?;
        let mut book_stmt = tx.prepare_cached(UPSERT_BOOK_SQL)?;
        for a in authors {
            author_stmt.execute(params![
                a.id,
                a.name,
                a.path,
                a.library_id,
                a.book_count as i64
            ])?;
            for b in &a.books {
                book_stmt.execute(params![
                    b.id,
                    b.title,
                    b.path,
                    b.author_id,
                    b.library_id,
                    b.size as i64,
                    b.created_at as i64,
                    b.starred as i64,
                    b.deleted as i64
                ])?;
            }
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
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM comics WHERE library_id = ?1", params![id])?;
    tx.execute("DELETE FROM books WHERE library_id = ?1", params![id])?;
    tx.execute("DELETE FROM authors WHERE library_id = ?1", params![id])?;
    tx.execute("DELETE FROM libraries WHERE id = ?1", params![id])?;
    tx.commit()
}

pub fn reorder(conn: &Connection, ordered_ids: &[String]) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    for (index, id) in ordered_ids.iter().enumerate() {
        tx.execute(
            "UPDATE libraries SET sort_order = ?2 WHERE id = ?1",
            params![id, index as i64],
        )?;
    }
    tx.commit()
}

enum CatalogTagTable {
    Comics,
    Books,
}

fn update_catalog_tags(
    conn: &Connection,
    table: CatalogTagTable,
    id: &str,
    tags: &FileTags,
) -> rusqlite::Result<()> {
    if tags.starred.is_none() && tags.deleted.is_none() {
        return Ok(());
    }

    let starred = tags.starred.map(i64::from);
    let deleted = tags.deleted.map(i64::from);
    let sql = match table {
        CatalogTagTable::Comics => {
            "UPDATE comics
             SET starred = COALESCE(?2, starred), deleted = COALESCE(?3, deleted)
             WHERE id = ?1"
        }
        CatalogTagTable::Books => {
            "UPDATE books
             SET starred = COALESCE(?2, starred), deleted = COALESCE(?3, deleted)
             WHERE id = ?1"
        }
    };
    conn.execute(sql, params![id, starred, deleted])?;
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
    update_catalog_tags(&conn, CatalogTagTable::Comics, id, tags).map_err(|e| e.to_string())?;
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
    update_catalog_tags(&conn, CatalogTagTable::Books, id, tags).map_err(|e| e.to_string())?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Author, Book, Comic};

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory library db");
        conn.execute_batch(LIBRARY_SCHEMA)
            .expect("create library schema");
        conn
    }

    #[test]
    fn production_schema_creates_catalog_tables_and_indexes() {
        let conn = test_conn();
        let names = conn
            .prepare(
                "SELECT name FROM sqlite_master
                 WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%'
                 ORDER BY name",
            )
            .expect("prepare schema query")
            .query_map([], |row| row.get::<_, String>(0))
            .expect("query schema")
            .collect::<rusqlite::Result<Vec<_>>>()
            .expect("collect schema names");

        assert_eq!(
            names,
            vec![
                "authors",
                "books",
                "comics",
                "idx_authors_library",
                "idx_books_author",
                "idx_comics_library",
                "libraries",
            ]
        );
    }

    #[test]
    fn catalog_returns_flat_rows_with_libraries_in_sort_order() {
        let conn = test_conn();
        let later = Library {
            id: "library-2".to_string(),
            name: "Books".to_string(),
            path: "/library/books".to_string(),
            type_: "book".to_string(),
            created_at: 2,
            sort_order: 1,
        };
        let earlier = Library {
            id: "library-1".to_string(),
            name: "Comics".to_string(),
            path: "/library/comics".to_string(),
            type_: "comic".to_string(),
            created_at: 1,
            sort_order: 0,
        };
        upsert_library(&conn, &later).expect("insert later library");
        upsert_library(&conn, &earlier).expect("insert earlier library");
        upsert_comic(
            &conn,
            &Comic {
                id: "comic-1".to_string(),
                title: "Comic 1".to_string(),
                path: "/library/comics/Comic 1".to_string(),
                cover: "/file?path=cover".to_string(),
                library_id: "library-1".to_string(),
                created_at: 10,
                starred: true,
                deleted: false,
            },
        )
        .expect("insert comic");
        upsert_author(
            &conn,
            &Author {
                id: "author-1".to_string(),
                name: "Author 1".to_string(),
                path: "/library/books/Author 1".to_string(),
                library_id: "library-2".to_string(),
                book_count: 1,
                books: Vec::new(),
            },
        )
        .expect("insert author");
        upsert_book(
            &conn,
            &Book {
                id: "book-1".to_string(),
                title: "Book 1".to_string(),
                path: "/library/books/Author 1/Book 1.txt".to_string(),
                author_id: "author-1".to_string(),
                library_id: "library-2".to_string(),
                size: 128,
                created_at: 20,
                starred: false,
                deleted: true,
            },
        )
        .expect("insert book");

        let catalog = get_catalog(&conn).expect("read catalog");

        assert_eq!(
            catalog
                .libraries
                .iter()
                .map(|library| library.id.as_str())
                .collect::<Vec<_>>(),
            vec!["library-1", "library-2"]
        );
        assert_eq!(catalog.comics[0].title, "Comic 1");
        assert!(catalog.comics[0].starred);
        assert_eq!(catalog.authors[0].book_count, 1);
        assert_eq!(catalog.books[0].author_id, "author-1");
        assert!(catalog.books[0].deleted);
    }

    #[test]
    fn reorder_updates_only_the_requested_library_order() {
        let conn = test_conn();
        for (id, sort_order) in [("library-1", 0), ("library-2", 1), ("library-3", 2)] {
            upsert_library(
                &conn,
                &Library {
                    id: id.to_string(),
                    name: id.to_string(),
                    path: format!("/library/{id}"),
                    type_: "comic".to_string(),
                    created_at: 1,
                    sort_order,
                },
            )
            .expect("insert library");
        }

        reorder(&conn, &["library-3".to_string(), "library-1".to_string()])
            .expect("reorder libraries");

        let sort_order = |id: &str| {
            conn.query_row(
                "SELECT sort_order FROM libraries WHERE id = ?1",
                params![id],
                |row| row.get::<_, i64>(0),
            )
            .expect("read library sort order")
        };
        assert_eq!(sort_order("library-3"), 0);
        assert_eq!(sort_order("library-1"), 1);
        assert_eq!(sort_order("library-2"), 1);
    }

    #[test]
    fn replacing_library_content_removes_stale_rows_and_persists_nested_books() {
        let conn = test_conn();
        let library = Library {
            id: "library-1".to_string(),
            name: "Library".to_string(),
            path: "/library".to_string(),
            type_: "book".to_string(),
            created_at: 1,
            sort_order: 0,
        };
        upsert_library(&conn, &library).expect("insert library");
        upsert_comic(
            &conn,
            &Comic {
                id: "stale-comic".to_string(),
                title: "Stale Comic".to_string(),
                path: "/library/stale".to_string(),
                cover: "/file?path=stale".to_string(),
                library_id: "library-1".to_string(),
                created_at: 1,
                starred: false,
                deleted: false,
            },
        )
        .expect("insert stale comic");

        replace_library_content(
            &conn,
            "library-1",
            &[],
            &[Author {
                id: "author-1".to_string(),
                name: "Author".to_string(),
                path: "/library/Author".to_string(),
                library_id: "library-1".to_string(),
                book_count: 1,
                books: vec![Book {
                    id: "book-1".to_string(),
                    title: "Book".to_string(),
                    path: "/library/Author/Book.txt".to_string(),
                    author_id: "author-1".to_string(),
                    library_id: "library-1".to_string(),
                    size: 10,
                    created_at: 2,
                    starred: true,
                    deleted: false,
                }],
            }],
        )
        .expect("replace library content");

        let catalog = get_catalog(&conn).expect("read catalog");
        assert!(catalog.comics.is_empty());
        assert_eq!(catalog.authors[0].id, "author-1");
        assert_eq!(catalog.books[0].id, "book-1");
        assert!(catalog.books[0].starred);
    }

    #[test]
    fn remove_deletes_library_and_all_catalog_rows_for_it() {
        let conn = test_conn();
        let library = Library {
            id: "library-1".to_string(),
            name: "Library".to_string(),
            path: "/library".to_string(),
            type_: "comic".to_string(),
            created_at: 1,
            sort_order: 0,
        };
        upsert_library(&conn, &library).expect("insert library");
        replace_library_content(
            &conn,
            "library-1",
            &[Comic {
                id: "comic-1".to_string(),
                title: "Comic".to_string(),
                path: "/library/Comic".to_string(),
                cover: "/file?path=cover".to_string(),
                library_id: "library-1".to_string(),
                created_at: 1,
                starred: false,
                deleted: true,
            }],
            &[],
        )
        .expect("insert comic content");

        remove(&conn, "library-1").expect("remove library");

        let catalog = get_catalog(&conn).expect("read catalog after remove");
        assert!(catalog.libraries.is_empty());
        assert!(catalog.comics.is_empty());
    }

    #[test]
    fn upserting_existing_rows_replaces_catalog_fields() {
        let conn = test_conn();
        let mut library = Library {
            id: "library-1".to_string(),
            name: "Old".to_string(),
            path: "/old".to_string(),
            type_: "comic".to_string(),
            created_at: 1,
            sort_order: 0,
        };
        upsert_library(&conn, &library).expect("insert library");
        library.name = "New".to_string();
        library.path = "/new".to_string();
        library.sort_order = 2;
        upsert_library(&conn, &library).expect("replace library");

        let catalog = get_catalog(&conn).expect("read catalog");
        assert_eq!(catalog.libraries[0].name, "New");
        assert_eq!(catalog.libraries[0].path, "/new");
        assert_eq!(catalog.libraries[0].sort_order, 2);
    }

    #[test]
    fn catalog_tag_updates_preserve_unspecified_fields() {
        let conn = test_conn();
        let library = Library {
            id: "library-1".to_string(),
            name: "Library".to_string(),
            path: "/library".to_string(),
            type_: "comic".to_string(),
            created_at: 1,
            sort_order: 0,
        };
        upsert_library(&conn, &library).expect("insert library");
        upsert_comic(
            &conn,
            &Comic {
                id: "comic-1".to_string(),
                title: "Comic".to_string(),
                path: "/library/Comic".to_string(),
                cover: "/file?path=cover".to_string(),
                library_id: "library-1".to_string(),
                created_at: 1,
                starred: false,
                deleted: true,
            },
        )
        .expect("insert comic");

        update_catalog_tags(
            &conn,
            CatalogTagTable::Comics,
            "comic-1",
            &FileTags {
                starred: Some(true),
                deleted: None,
            },
        )
        .expect("update comic tags");

        let catalog = get_catalog(&conn).expect("read catalog");
        assert!(catalog.comics[0].starred);
        assert!(catalog.comics[0].deleted);

        update_catalog_tags(
            &conn,
            CatalogTagTable::Comics,
            "comic-1",
            &FileTags {
                starred: None,
                deleted: Some(false),
            },
        )
        .expect("update comic delete tag");

        let catalog = get_catalog(&conn).expect("read catalog");
        assert!(catalog.comics[0].starred);
        assert!(!catalog.comics[0].deleted);
    }
}
