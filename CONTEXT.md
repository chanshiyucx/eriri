# Eriri Reader

Eriri is a local digital reader for comics and books. Its domain is the user's imported reading material, the catalog used to browse it, and the progress state used to resume reading.

## Language

**Library**:
An imported root folder that contains either comics or books.
_Avoid_: Collection, source, shelf

**Catalog**:
A flat snapshot of libraries and their discovered reading material.
_Avoid_: Tree, index, database dump

**Comic**:
A directory of ordered image pages that can be opened in the comic reader.
_Avoid_: Manga, album, image folder

**Comic Image**:
One page image inside a comic, ordered by its filename for reading.
_Avoid_: Page file, asset, picture

**Book**:
A text file that can be opened in the book reader.
_Avoid_: Novel, document, text asset

**Author**:
A directory grouping books in a book library.
_Avoid_: Writer, creator, folder

**Chapter**:
A detected heading inside a book that marks a navigable reading position.
_Avoid_: Section, anchor, heading

**Reading Progress**:
The last known reading position for a comic or book.
_Avoid_: Bookmark, history, cursor

**Favorite Chapter**:
A chapter line in a book that the reader has marked for quick return.
_Avoid_: Starred chapter, saved heading

**File Tag**:
A user-visible marker on a comic, comic image, or book that records starred or deleted intent.
_Avoid_: Label, flag, metadata bit
