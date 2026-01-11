import { invoke } from '@tauri-apps/api/core'
import {
  LibraryType,
  type Author,
  type Comic,
  type Image,
  type ImageCache,
  type Video,
} from '@/types/library'

export async function generateUuid(input: string): Promise<string> {
  try {
    return await invoke<string>('generate_uuid_command', {
      input,
    })
  } catch (error) {
    console.error('Failed to generate UUID:', error)
    return ''
  }
}

export async function getLibraryType(
  libraryPath: string,
): Promise<LibraryType> {
  try {
    return await invoke<LibraryType>('get_library_type', {
      libraryPath,
    })
  } catch (error) {
    console.error('Failed to get library type:', error)
    return LibraryType.book
  }
}

export async function scanBookLibrary(
  libraryPath: string,
  libraryId: string,
): Promise<Author[]> {
  try {
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
    return await invoke<Comic[]>('scan_comic_library', {
      libraryPath,
      libraryId,
    })
  } catch (error) {
    console.error('Failed to scan comic library:', error)
    return []
  }
}

export async function scanVideoLibrary(
  libraryPath: string,
  libraryId: string,
): Promise<Video[]> {
  try {
    return await invoke<Video[]>('scan_video_library', {
      libraryPath,
      libraryId,
    })
  } catch (error) {
    console.error('Failed to scan video library:', error)
    return []
  }
}

export async function scanComicImages(comicPath: string): Promise<Image[]> {
  try {
    return await invoke<Image[]>('scan_comic_images', {
      comicPath,
    })
  } catch (error) {
    console.error('Failed to scan comic images:', error)
    return []
  }
}

export async function cleanExpiredThumbnailCache(): Promise<void> {
  try {
    await invoke('clean_thumbnail_cache', {
      daysOld: 30,
      maxSizeMb: 1024,
    })
  } catch (error) {
    console.error('Failed to clean expired thumbnail cache:', error)
  }
}

export async function cleanAllThumbnailCache(): Promise<void> {
  try {
    await invoke('clean_thumbnail_cache', {
      daysOld: 0,
      maxSizeMb: 0,
    })
  } catch (error) {
    console.error('Failed to clean all thumbnail cache:', error)
  }
}

export async function getThumbnailStats(rescan = false): Promise<ImageCache> {
  try {
    const [count, size] = await invoke<[number, number]>(
      'get_thumbnail_stats',
      { rescan },
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
    await invoke('set_file_tag', {
      path,
      tags,
    })
    return true
  } catch (error) {
    console.error('Failed to tag file:', error)
    return false
  }
}

export async function getCacheDir(): Promise<string | null> {
  try {
    return await invoke<string | null>('get_cache_dir')
  } catch (error) {
    console.error('Failed to get cache dir:', error)
    return null
  }
}

export async function setCacheDir(path: string): Promise<void> {
  try {
    await invoke('set_cache_dir', { path })
  } catch (error) {
    console.error('Failed to set cache dir:', error)
    throw error
  }
}

export async function openPathNative(path: string): Promise<void> {
  try {
    await invoke('open_path_native', { path })
  } catch (error) {
    console.error('Failed to open path:', error)
    throw error
  }
}
