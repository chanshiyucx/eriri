import { convertFileSrc } from '@tauri-apps/api/core'
import { readDir, stat, type DirEntry } from '@tauri-apps/plugin-fs'
import type { Author, Book, Comic } from '@/types/library'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const
const BOOK_EXTENSIONS = ['txt'] as const

const joinPath = (...parts: string[]): string => {
  return parts
    .map((part, i) => {
      if (i === 0) return part.replace(/\/+$/, '')
      return part.replace(/^\/+/, '').replace(/\/+$/, '')
    })
    .join('/')
}

export async function isBookLibrary(libraryPath: string): Promise<boolean> {
  try {
    const entries = await readDir(libraryPath)
    // Check first directory
    const firstDir = entries.find((e) => e.isDirectory)
    if (!firstDir) return false

    const subEntries = await readDir(joinPath(libraryPath, firstDir.name))
    // Check if first file is txt (simplistic but requested)
    // Check if any file is txt
    const hasTxt = subEntries.some(
      (e) => e.isFile && e.name.toLowerCase().endsWith('.txt'),
    )
    if (hasTxt) {
      return true
    }
  } catch (e) {
    console.error('Failed to check book library type', e)
  }
  return false
}

export async function scanLibrary(
  libraryPath: string,
  libraryId: string,
): Promise<Comic[]> {
  const newComics: Comic[] = []
  try {
    const entries: DirEntry[] = await readDir(libraryPath)

    for (const entry of entries) {
      if (entry.isDirectory) {
        const comicPath = joinPath(libraryPath, entry.name)
        const comicId = crypto.randomUUID()

        // Scan for cover and metadata
        let cover = ''
        let createdAt = Date.now()

        try {
          const s = await stat(comicPath)
          createdAt = s.birthtime?.getTime() ?? s.mtime?.getTime() ?? Date.now()

          const files: DirEntry[] = await readDir(comicPath)
          const images = files
            .filter(
              (file) =>
                file.isFile &&
                IMAGE_EXTENSIONS.some((ext) =>
                  file.name.toLowerCase().endsWith(ext),
                ),
            )
            .sort((a, b) =>
              a.name.localeCompare(b.name, undefined, {
                numeric: true,
                sensitivity: 'base',
              }),
            )

          if (images.length > 0) {
            const coverPath = joinPath(comicPath, images[0].name)
            cover = convertFileSrc(coverPath)
          }
        } catch (err) {
          console.error(`Failed to scan comic ${entry.name}`, err)
        }

        newComics.push({
          id: comicId,
          title: entry.name,
          path: comicPath,
          cover,
          libraryId,
          createdAt,
          progress: {
            current: 0,
            total: 0,
            percent: 0,
            lastRead: Date.now(),
          },
        })
      }
    }
  } catch (error) {
    console.error('Failed to scan library:', error)
    throw error
  }
  return newComics
}

export async function scanBookLibrary(
  libraryPath: string,
  libraryId: string,
): Promise<{ authors: Author[]; books: Book[] }> {
  // No heuristic here, just scanning.
  // The caller (ContentArea) decides when to call this based on isBookLibrary check usually?
  // Current logic in ContentArea calls this as fallback.
  // The user asked "How to identify import is comic or book lib".
  // I will export an `detectLibraryType` helper or simple `isBookLibrary` check and use it in ContentArea.
  const authors: Author[] = []
  const books: Book[] = []

  try {
    const entries: DirEntry[] = await readDir(libraryPath)

    for (const entry of entries) {
      if (entry.isDirectory) {
        const authorName = entry.name
        const authorPath = joinPath(libraryPath, authorName)
        const authorId = crypto.randomUUID()

        let bookCount = 0

        try {
          const authorFiles: DirEntry[] = await readDir(authorPath)

          for (const file of authorFiles) {
            if (
              file.isFile &&
              BOOK_EXTENSIONS.some((ext) =>
                file.name.toLowerCase().endsWith(ext),
              )
            ) {
              const bookPath = joinPath(authorPath, file.name)
              const bookId = crypto.randomUUID()
              let size = 0
              let createdAt = Date.now()

              try {
                const s = await stat(bookPath)
                size = s.size
                createdAt =
                  s.birthtime?.getTime() ?? s.mtime?.getTime() ?? Date.now()
              } catch (e) {
                console.error(`Failed to stat book ${file.name}`, e)
              }

              books.push({
                id: bookId,
                title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
                path: bookPath,
                authorId,
                libraryId,
                size,
                createdAt,
                progress: {
                  startCharIndex: 0,
                  totalChars: 0,
                  percent: 0,
                  lastRead: Date.now(),
                },
              })
              bookCount++
            }
          }

          authors.push({
            id: authorId,
            name: authorName,
            path: authorPath,
            libraryId,
            bookCount,
          })
        } catch (err) {
          console.error(`Failed to scan author ${authorName}`, err)
        }
      }
    }
  } catch (error) {
    console.error('Failed to scan book library:', error)
    throw error
  }

  return { authors, books }
}

export async function scanComicImages(
  comicPath: string,
): Promise<{ url: string; filename: string }[]> {
  try {
    const files: DirEntry[] = await readDir(comicPath)
    return files
      .filter(
        (file) =>
          file.isFile &&
          IMAGE_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)),
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
      )
      .map((file) => ({
        url: convertFileSrc(joinPath(comicPath, file.name)),
        filename: file.name,
      }))
  } catch (error) {
    console.error('Failed to scan comic images:', error)
    return []
  }
}
