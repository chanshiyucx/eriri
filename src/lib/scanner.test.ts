import { describe, expect, it, vi } from 'vitest'
import {
  openPathNative,
  parseBook,
  scanComicImages,
  setFileTag,
} from '@/lib/scanner'

const book = {
  lines: ['Chapter 1', 'Body'],
  chapters: [{ title: 'Chapter 1', lineIndex: 0 }],
}

describe('scanner API', () => {
  it('scans comic images with an encoded path', async () => {
    const images = [{ filename: '001.jpg' }]
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(images), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(scanComicImages('/漫画/A & B')).resolves.toEqual(images)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scan-comic-images?path=%2F%E6%BC%AB%E7%94%BB%2FA+%26+B',
      { cache: 'no-store' },
    )
  })

  it('rejects when the image scan request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(scanComicImages('/comic')).rejects.toThrow('offline')
  })

  it('parses a normal JSON response without progress reporting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(book), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(parseBook('/books/a.txt')).resolves.toEqual(book)
  })

  it('streams book parsing progress and completes at 100 percent', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(book))
    const midpoint = Math.floor(bytes.length / 2)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, midpoint))
        controller.enqueue(bytes.slice(midpoint))
        controller.close()
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(body, {
          status: 200,
          headers: { 'x-uncompressed-length': String(bytes.length) },
        }),
      ),
    )
    const onProgress = vi.fn()

    await expect(parseBook('/books/a.txt', onProgress)).resolves.toEqual(book)
    expect(onProgress).toHaveBeenLastCalledWith(100)
    expect(onProgress.mock.calls.slice(0, -1).flat()).toEqual(
      expect.arrayContaining([expect.any(Number)]),
    )
  })

  it('caps streaming progress below completion until JSON is parsed', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(book))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(bytes)
              controller.close()
            },
          }),
          { headers: { 'x-uncompressed-length': '1' } },
        ),
      ),
    )
    const onProgress = vi.fn()

    await parseBook('/books/a.txt', onProgress)

    expect(onProgress).toHaveBeenNthCalledWith(1, 99)
    expect(onProgress).toHaveBeenNthCalledWith(2, 100)
  })

  it('falls back to JSON parsing when a valid length is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(book), {
          headers: { 'x-uncompressed-length': 'invalid' },
        }),
      ),
    )
    const onProgress = vi.fn()

    await expect(parseBook('/books/a.txt', onProgress)).resolves.toEqual(book)
    expect(onProgress).not.toHaveBeenCalled()
  })

  it('returns empty content for missing bodies and rejected responses', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { 'x-uncompressed-length': '10' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(parseBook('/empty', vi.fn())).resolves.toEqual({
      lines: [],
      chapters: [],
    })
    await expect(parseBook('/failed')).resolves.toEqual({
      lines: [],
      chapters: [],
    })
    expect(console.error).toHaveBeenCalledTimes(2)
  })

  it('writes file tags and reports HTTP failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      setFileTag('/comic/001.jpg', { starred: true, deleted: false }),
    ).resolves.toBe(true)
    await expect(setFileTag('/comic/001.jpg', { deleted: true })).resolves.toBe(
      false,
    )
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: '/comic/001.jpg',
        starred: true,
        deleted: false,
      }),
    })
    expect(console.error).toHaveBeenCalledWith(
      'Failed to tag file:',
      expect.any(Error),
    )
  })

  it('reveals native paths and contains backend failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(openPathNative('/book.txt')).resolves.toBeUndefined()
    await expect(openPathNative('/missing.txt')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/book.txt' }),
    })
    expect(console.error).toHaveBeenCalledWith(
      'Failed to open path:',
      expect.any(Error),
    )
  })
})
