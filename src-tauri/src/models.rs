use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Book {
    pub id: String,
    pub title: String,
    pub path: String,
    #[serde(rename = "authorId")]
    pub author_id: String,
    #[serde(rename = "libraryId")]
    pub library_id: String,
    pub size: u64,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    pub starred: bool,
    pub deleted: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Author {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "libraryId")]
    pub library_id: String,
    pub book_count: u32,
    pub books: Vec<Book>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Comic {
    pub id: String,
    pub title: String,
    pub path: String,
    pub cover: String,
    #[serde(rename = "libraryId")]
    pub library_id: String,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    pub starred: bool,
    pub deleted: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Video {
    pub id: String,
    pub title: String,
    pub path: String,
    pub url: String,
    pub cover: String,
    #[serde(rename = "libraryId")]
    pub library_id: String,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    pub size: u64,
    pub width: u32,
    pub height: u32,
    pub duration: u64,
    pub starred: bool,
    pub deleted: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComicImage {
    pub path: String,
    pub url: String,
    pub thumbnail: String,
    pub filename: String,
    pub width: u32,
    pub height: u32,
    pub starred: bool,
    pub deleted: bool,
    pub index: u32,
}

#[derive(Deserialize)]
pub struct FileTags {
    pub starred: Option<bool>,
    pub deleted: Option<bool>,
}
