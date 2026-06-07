import { apiGet } from '@/lib/http'
import type { BookContent, Image } from '@/types/library'

const qs = (params: Record<string, string>): string =>
  new URLSearchParams(params).toString()

export async function scanComicImages(comicPath: string): Promise<Image[]> {
  try {
    return await apiGet<Image[]>(
      `/api/scan-comic-images?${qs({ path: comicPath })}`,
    )
  } catch (error) {
    console.error('Failed to scan comic images:', error)
    return []
  }
}

export async function parseBook(path: string): Promise<BookContent> {
  try {
    return await apiGet<BookContent>(`/api/parse-book?${qs({ path })}`)
  } catch (error) {
    console.error('Failed to parse book:', error)
    return { lines: [], chapters: [] }
  }
}

export async function setFileTag(
  path: string,
  tags: { starred?: boolean; deleted?: boolean },
): Promise<boolean> {
  try {
    const res = await fetch('/api/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, ...tags }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return true
  } catch (error) {
    console.error('Failed to tag file:', error)
    return false
  }
}

/** Reveal a path in Finder on the Mac host. */
export async function openPathNative(path: string): Promise<void> {
  try {
    const res = await fetch('/api/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (error) {
    console.error('Failed to open path:', error)
  }
}
