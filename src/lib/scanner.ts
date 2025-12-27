import { invoke } from '@tauri-apps/api/core'
import type { Author, Comic, Image, ImageCache } from '@/types/library'

export async function generateUuid(input: string): Promise<string> {
  try {
    return await invoke<string>('generate_uuid', {
      input,
    })
  } catch (error) {
    console.error('Failed to generate UUID:', error)
    return ''
  }
}

export async function isBookLibrary(libraryPath: string): Promise<boolean> {
  try {
    return await invoke<boolean>('is_book_library', {
      libraryPath,
    })
  } catch (error) {
    console.error('Failed to check if library is a book library:', error)
    return false
  }
}

export async function scanBookLibrary(
  libraryPath: string,
  libraryId: string,
): Promise<Author[]> {
  try {
    console.log('Log: scanBookLibrary: ', libraryPath, libraryId)
    return await invoke<Author[]>('scan_book_library', {
      libraryPath,
      libraryId,
    })
  } catch (error) {
    console.error('Failed to scan book library:', error)
    return []
  }
}

export async function scanComicLibrary(
  libraryPath: string,
  libraryId: string,
): Promise<Comic[]> {
  try {
    console.log('Log: scanComicLibrary: ', libraryPath, libraryId)
    return await invoke<Comic[]>('scan_comic_library', {
      libraryPath,
      libraryId,
    })
  } catch (error) {
    console.error('Failed to scan comic library:', error)
    return []
  }
}

export async function scanComicImages(comicPath: string): Promise<Image[]> {
  try {
    console.log('Log: scanComicImages: ', comicPath)
    return await invoke<Image[]>('scan_comic_images', {
      comicPath,
    })
  } catch (error) {
    console.error('Failed to scan comic images:', error)
    return []
  }
}

export async function cleanThumbnailCache(): Promise<void> {
  try {
    console.log('Log: cleanThumbnailCache: ')
    return await invoke('clean_thumbnail_cache', {
      daysOld: 30,
      maxSizeMb: 1024,
    })
  } catch (error) {
    console.error('Failed to clean thumbnail cache:', error)
  }
}

export async function getThumbnailStats(): Promise<ImageCache> {
  try {
    console.log('Log: getThumbnailStats: ')
    const [count, size] = await invoke<[number, number]>(
      'get_thumbnail_stats',
      {},
    )
    return { count, size }
  } catch (error) {
    console.error('Failed to get thumbnail stats:', error)
    return { count: 0, size: 0 }
  }
}

export async function setFileTag(
  path: string,
  tags: { starred?: boolean; deleted?: boolean },
): Promise<boolean> {
  try {
    console.log('Log: setFileTag: ', path, tags)
    return await invoke<boolean>('set_file_tag', {
      path,
      tags,
    })
  } catch (error) {
    console.error('Failed to tag file:', error)
    return false
  }
}
