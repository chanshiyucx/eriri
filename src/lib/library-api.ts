import { apiGet } from '@/lib/http'
import type { Author, Book, Comic, FileTags, Library } from '@/types/library'

/** Flat catalog snapshot: authors carry no nested books (joined client-side). */
export interface Catalog {
  libraries: Library[]
  comics: Comic[]
  authors: Author[]
  books: Book[]
}

async function send(
  path: string,
  method: string,
  body?: unknown,
): Promise<void> {
  const res = await fetch(path, {
    method,
    headers:
      body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${method} ${path}`)
}

export const fetchCatalog = (): Promise<Catalog> =>
  apiGet<Catalog>('/api/libraries')

export const refreshLibrary = (id: string): Promise<void> =>
  send(`/api/library/${id}/refresh`, 'POST')

export const removeLibrary = (id: string): Promise<void> =>
  send(`/api/library/${id}`, 'DELETE')

export async function reorderLibraries(orderedIds: string[]): Promise<void> {
  try {
    await send('/api/libraries/order', 'PUT', orderedIds)
  } catch (error) {
    console.error('Failed to reorder libraries:', error)
  }
}

export async function setComicTags(
  id: string,
  tags: FileTags,
): Promise<boolean> {
  try {
    await send(`/api/comic/${id}/tags`, 'POST', tags)
    return true
  } catch (error) {
    console.error('Failed to set comic tags:', error)
    return false
  }
}

export async function setBookTags(
  id: string,
  tags: FileTags,
): Promise<boolean> {
  try {
    await send(`/api/book/${id}/tags`, 'POST', tags)
    return true
  } catch (error) {
    console.error('Failed to set book tags:', error)
    return false
  }
}
