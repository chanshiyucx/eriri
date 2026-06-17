import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchProgress,
  removeBookFavorites,
  removeBookProgress,
  removeComicProgress,
  saveBookFavorites,
  saveBookProgress,
  saveComicProgress,
} from '@/lib/progress-api'

describe('progress API', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('fetches the reading progress snapshot from the backend', async () => {
    const snapshot = {
      comics: {
        'comic-1': { current: 1, total: 3, percent: 50, lastRead: 100 },
      },
      books: {},
      favoriteChapters: {},
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(snapshot), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchProgress()).resolves.toEqual(snapshot)
    expect(fetchMock).toHaveBeenCalledWith('/api/progress', {
      cache: 'no-store',
    })
  })

  it('writes comic and book progress as JSON', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await saveComicProgress('comic-1', {
      current: 2,
      total: 5,
      percent: 50,
      lastRead: 100,
    })
    await saveBookProgress('book-1', {
      current: 10,
      total: 100,
      percent: 10,
      lastRead: 200,
      currentChapterTitle: '第一章',
    })
    await saveBookFavorites('book-1', [0, 10])

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/progress/comic/comic-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current: 2,
          total: 5,
          percent: 50,
          lastRead: 100,
        }),
      },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/progress/book/book-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current: 10,
        total: 100,
        percent: 10,
        lastRead: 200,
        currentChapterTitle: '第一章',
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/progress/book/book-1/favorites',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([0, 10]),
      },
    )
  })

  it('deletes progress and favorites without a JSON body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await removeComicProgress('comic-1')
    await removeBookProgress('book-1')
    await removeBookFavorites('book-1')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/progress/comic/comic-1',
      {
        method: 'DELETE',
        headers: undefined,
        body: undefined,
      },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/progress/book/book-1', {
      method: 'DELETE',
      headers: undefined,
      body: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/progress/book/book-1/favorites',
      {
        method: 'DELETE',
        headers: undefined,
        body: undefined,
      },
    )
  })

  it('logs failed writes without throwing back to the store', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    )

    await expect(
      saveComicProgress('comic-1', {
        current: 2,
        total: 5,
        percent: 50,
        lastRead: 100,
      }),
    ).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalledWith(
      'Progress write failed (PUT /api/progress/comic/comic-1):',
      expect.any(Error),
    )
  })
})
