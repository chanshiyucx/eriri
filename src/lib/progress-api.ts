import { apiGet } from '@/lib/http'
import type { BookProgress, ComicProgress } from '@/types/library'

/**
 * Reading-progress access. The backend (SQLite) is the source of truth; writes
 * are fire-and-forget (the store mirrors optimistically), so failures are only
 * logged, never thrown.
 */
export interface ProgressSnapshot {
  comics: Record<string, ComicProgress>
  books: Record<string, BookProgress>
  favoriteChapters: Record<string, number[]>
}

async function write(
  path: string,
  method: string,
  body?: unknown,
): Promise<void> {
  try {
    const res = await fetch(path, {
      method,
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (error) {
    console.error(`Progress write failed (${method} ${path}):`, error)
  }
}

export const fetchProgress = (): Promise<ProgressSnapshot> =>
  apiGet<ProgressSnapshot>('/api/progress')

export const saveComicProgress = (
  comicId: string,
  progress: ComicProgress,
): Promise<void> => write(`/api/progress/comic/${comicId}`, 'PUT', progress)

export const removeComicProgress = (comicId: string): Promise<void> =>
  write(`/api/progress/comic/${comicId}`, 'DELETE')

export const saveBookProgress = (
  bookId: string,
  progress: BookProgress,
): Promise<void> => write(`/api/progress/book/${bookId}`, 'PUT', progress)

export const removeBookProgress = (bookId: string): Promise<void> =>
  write(`/api/progress/book/${bookId}`, 'DELETE')

export const saveBookFavorites = (
  bookId: string,
  lines: number[],
): Promise<void> =>
  write(`/api/progress/book/${bookId}/favorites`, 'PUT', lines)

export const removeBookFavorites = (bookId: string): Promise<void> =>
  write(`/api/progress/book/${bookId}/favorites`, 'DELETE')
