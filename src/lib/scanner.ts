import { convertFileSrc } from '@tauri-apps/api/core'
import { readDir, stat, type DirEntry } from '@tauri-apps/plugin-fs'
import { v5 as uuidv5 } from 'uuid'
import type { Author, Book, Comic } from '@/types/library'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const
const BOOK_EXTENSIONS = ['txt'] as const

// Namespace for UUID v5 generation (randomly generated once)
const NAMESPACE = uuidv5.URL

const isBookFile = (file: DirEntry): boolean => {
  return (
    file.isFile &&
    BOOK_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
  )
}

const isComicFile = (file: DirEntry): boolean => {
  return (
    file.isFile &&
    IMAGE_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
  )
}

const joinPath = (...parts: string[]): string => {
  return parts
    .map((part, i) => {
      if (i === 0) return part.replace(/\/+$/, '')
      return part.replace(/^\/+/, '').replace(/\/+$/, '')
    })
    .join('/')
}

const removeExtension = (filename: string): string => {
  return filename.replace(/\.[^/.]+$/, '')
}

export async function isBookLibrary(libraryPath: string): Promise<boolean> {
  try {
    const entries = await readDir(libraryPath)
    const firstDir = entries.find((e) => e.isDirectory)
    if (!firstDir) return false

    const subEntries = await readDir(joinPath(libraryPath, firstDir.name))
    return subEntries.some(isBookFile)
  } catch (e) {
    console.error('Failed to check book library type', e)
  }
  return false
}

export async function scanBookLibrary(
  libraryPath: string,
  libraryId: string,
): Promise<Author[]> {
  const authors: Author[] = []

  try {
    const entries: DirEntry[] = await readDir(libraryPath)
    for (const entry of entries) {
      if (!entry.isDirectory) continue

      const authorName = entry.name
      const authorPath = joinPath(libraryPath, authorName)
      const authorId = uuidv5(authorPath, NAMESPACE)
      try {
        const authorFiles: DirEntry[] = await readDir(authorPath)
        const books: Book[] = []

        for (const file of authorFiles) {
          if (!isBookFile(file)) continue

          const bookPath = joinPath(authorPath, file.name)
          const bookId = uuidv5(bookPath, NAMESPACE)
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
            title: removeExtension(file.name),
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
        }
        authors.push({
          id: authorId,
          name: authorName,
          path: authorPath,
          libraryId,
          books,
        })
      } catch (err) {
        console.error(`Failed to scan author ${authorName}`, err)
      }
    }
  } catch (error) {
    console.error('Failed to scan book library:', error)
    throw error
  }

  return authors
}

export async function scanComicLibrary(
  libraryPath: string,
  libraryId: string,
): Promise<Comic[]> {
  const comics: Comic[] = []
  try {
    const entries: DirEntry[] = await readDir(libraryPath)

    for (const entry of entries) {
      if (!entry.isDirectory) continue

      const comicName = entry.name
      const comicPath = joinPath(libraryPath, comicName)
      const comicId = uuidv5(comicPath, NAMESPACE)
      let cover = ''
      let createdAt = Date.now()

      try {
        const s = await stat(comicPath)
        createdAt = s.birthtime?.getTime() ?? s.mtime?.getTime() ?? Date.now()

        const files: DirEntry[] = await readDir(comicPath)
        const images = files.filter(isComicFile).sort((a, b) =>
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
        console.error(`Failed to scan comic ${comicName}`, err)
      }

      comics.push({
        id: comicId,
        title: comicName,
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
  } catch (error) {
    console.error('Failed to scan library:', error)
    throw error
  }
  return comics
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

export async function getComicImageCount(comicPath: string): Promise<number> {
  try {
    const files: DirEntry[] = await readDir(comicPath)
    return files.filter(
      (file) =>
        file.isFile &&
        IMAGE_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)),
    ).length
  } catch (error) {
    console.error('Failed to get comic image count:', error)
    return 0
  }
}

export async function loadComicImageRange(
  comicPath: string,
  start: number,
  count: number,
): Promise<{ url: string; filename: string; index: number }[]> {
  try {
    const files: DirEntry[] = await readDir(comicPath)
    const imageFiles = files.filter(isComicFile).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    )

    const rangeFiles = imageFiles.slice(start, start + count)

    return rangeFiles.map((file, idx) => ({
      url: convertFileSrc(joinPath(comicPath, file.name)),
      filename: file.name,
      index: start + idx,
    }))
  } catch (error) {
    console.error('Failed to load comic image range:', error)
    return []
  }
}
