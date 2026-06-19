import { apiGet } from '@/lib/http'
import type { BookContent, Image } from '@/types/library'

const qs = (params: Record<string, string>): string =>
  new URLSearchParams(params).toString()

export async function scanComicImages(comicPath: string): Promise<Image[]> {
  return apiGet<Image[]>(`/api/scan-comic-images?${qs({ path: comicPath })}`)
}

export async function parseBook(
  path: string,
  onProgress?: (percent: number) => void,
): Promise<BookContent> {
  try {
    const res = await fetch(`/api/parse-book?${qs({ path })}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    // `x-uncompressed-length` is the original (pre-gzip) byte count; the bytes
    // we read below are already decompressed by the browser, so the ratio is
    // accurate. Without it (or a callback), fall back to a plain parse.
    const total = Number(res.headers.get('x-uncompressed-length')) || 0
    if (!onProgress || !total || !res.body) {
      return (await res.json()) as BookContent
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let text = ''
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.length
      text += decoder.decode(value, { stream: true })
      onProgress(Math.min(99, Math.round((received / total) * 100)))
    }
    text += decoder.decode()

    const result = JSON.parse(text) as BookContent
    onProgress(100)
    return result
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
