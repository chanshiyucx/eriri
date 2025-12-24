import { invoke } from '@tauri-apps/api/core'
import type { Author, Comic, Image } from '@/types/library'

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
