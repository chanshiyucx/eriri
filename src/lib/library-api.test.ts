import { describe, expect, it, vi } from 'vitest'
import {
  fetchCatalog,
  refreshLibrary,
  removeLibrary,
  reorderLibraries,
  setBookTags,
  setComicTags,
} from '@/lib/library-api'

describe('library API', () => {
  it('posts comic tags as JSON to the backend', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      setComicTags('comic-1', { starred: true, deleted: false }),
    ).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledWith('/api/comic/comic-1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred: true, deleted: false }),
    })
  })

  it('reports failed comic tag writes without throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    )

    await expect(setComicTags('comic-1', { starred: true })).resolves.toBe(
      false,
    )
    expect(console.error).toHaveBeenCalledWith(
      'Failed to set comic tags:',
      expect.any(Error),
    )
  })

  it('fetches the flat catalog without cache', async () => {
    const catalog = { libraries: [], comics: [], authors: [], books: [] }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(catalog), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchCatalog()).resolves.toEqual(catalog)

    expect(fetchMock).toHaveBeenCalledWith('/api/libraries', {
      cache: 'no-store',
    })
  })

  it('refreshes and removes libraries through their backend endpoints', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await refreshLibrary('library-1')
    await removeLibrary('library-1')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/library/library-1/refresh',
      {
        method: 'POST',
        headers: undefined,
        body: undefined,
      },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/library/library-1', {
      method: 'DELETE',
      headers: undefined,
      body: undefined,
    })
  })

  it('persists library order and logs failures without throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      reorderLibraries(['library-2', 'library-1']),
    ).resolves.toBeUndefined()
    await expect(reorderLibraries(['library-1'])).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/libraries/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['library-2', 'library-1']),
    })
    expect(console.error).toHaveBeenCalledWith(
      'Failed to reorder libraries:',
      expect.any(Error),
    )
  })

  it('reports book tag writes as success or failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(setBookTags('book-1', { deleted: true })).resolves.toBe(true)
    await expect(setBookTags('book-1', { deleted: false })).resolves.toBe(false)

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/book/book-1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted: true }),
    })
    expect(console.error).toHaveBeenCalledWith(
      'Failed to set book tags:',
      expect.any(Error),
    )
  })
})
