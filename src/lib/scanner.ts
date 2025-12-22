import { convertFileSrc } from '@tauri-apps/api/core'
import { readDir, stat, type DirEntry } from '@tauri-apps/plugin-fs'
import type { Comic } from '@/types/library'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const

const joinPath = (...parts: string[]): string => {
  return parts
    .map((part, i) => {
      if (i === 0) return part.replace(/\/+$/, '')
      return part.replace(/^\/+/, '').replace(/\/+$/, '')
    })
    .join('/')
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
