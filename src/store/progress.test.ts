import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/lib/progress-api'
import { useProgressStore } from '@/store/progress'

vi.mock('@/lib/progress-api', () => ({
  fetchProgress: vi.fn(),
  saveComicProgress: vi.fn().mockResolvedValue(undefined),
  removeComicProgress: vi.fn().mockResolvedValue(undefined),
  saveBookProgress: vi.fn().mockResolvedValue(undefined),
  removeBookProgress: vi.fn().mockResolvedValue(undefined),
  saveBookFavorites: vi.fn().mockResolvedValue(undefined),
  removeBookFavorites: vi.fn().mockResolvedValue(undefined),
}))

const mockedApi = vi.mocked(api)

describe('progress store', () => {
  beforeEach(() => {
    useProgressStore.setState(useProgressStore.getInitialState(), true)
  })

  it('hydrates reading progress from the backend snapshot', async () => {
    mockedApi.fetchProgress.mockResolvedValueOnce({
      comics: {
        'comic-1': { current: 2, total: 5, percent: 50, lastRead: 123 },
      },
      books: {
        'book-1': {
          current: 10,
          total: 100,
          percent: 10,
          lastRead: 456,
          currentChapterTitle: '第一章',
        },
      },
      favoriteChapters: {
        'book-1': [0, 10],
      },
    })

    await useProgressStore.getState().hydrate()

    expect(useProgressStore.getState().comics['comic-1']).toEqual({
      current: 2,
      total: 5,
      percent: 50,
      lastRead: 123,
    })
    expect(useProgressStore.getState().books['book-1']).toEqual({
      current: 10,
      total: 100,
      percent: 10,
      lastRead: 456,
      currentChapterTitle: '第一章',
    })
    expect(useProgressStore.getState().favoriteChapters['book-1']).toEqual([
      0, 10,
    ])
  })

  it('toggles favorite chapters and persists the next favorite set', () => {
    const store = useProgressStore.getState()

    store.toggleChapterFavorite('book-1', 10)
    store.toggleChapterFavorite('book-1', 20)
    store.toggleChapterFavorite('book-1', 10)

    expect(useProgressStore.getState().favoriteChapters['book-1']).toEqual([20])
    expect(mockedApi.saveBookFavorites).toHaveBeenNthCalledWith(
      1,
      'book-1',
      [10],
    )
    expect(mockedApi.saveBookFavorites).toHaveBeenNthCalledWith(
      2,
      'book-1',
      [10, 20],
    )
    expect(mockedApi.saveBookFavorites).toHaveBeenNthCalledWith(
      3,
      'book-1',
      [20],
    )
  })

  it('updates and removes comic and book progress optimistically', () => {
    const store = useProgressStore.getState()
    const comicProgress = { current: 1, total: 3, percent: 50, lastRead: 100 }
    const bookProgress = {
      current: 10,
      total: 100,
      percent: 10,
      lastRead: 200,
      currentChapterTitle: '第一章',
    }

    store.updateComicProgress('comic-1', comicProgress)
    store.updateBookProgress('book-1', bookProgress)

    expect(useProgressStore.getState().comics['comic-1']).toEqual(comicProgress)
    expect(useProgressStore.getState().books['book-1']).toEqual(bookProgress)
    expect(mockedApi.saveComicProgress).toHaveBeenCalledWith(
      'comic-1',
      comicProgress,
    )
    expect(mockedApi.saveBookProgress).toHaveBeenCalledWith(
      'book-1',
      bookProgress,
    )

    store.removeComicProgress('comic-1')
    store.removeBookProgress('book-1')

    expect(useProgressStore.getState().comics['comic-1']).toBeUndefined()
    expect(useProgressStore.getState().books['book-1']).toBeUndefined()
    expect(mockedApi.removeComicProgress).toHaveBeenCalledWith('comic-1')
    expect(mockedApi.removeBookProgress).toHaveBeenCalledWith('book-1')
  })

  it('removes the last favorite chapter and clears all favorites for a book', () => {
    const store = useProgressStore.getState()

    store.toggleChapterFavorite('book-1', 10)
    store.toggleChapterFavorite('book-1', 10)

    expect(
      useProgressStore.getState().favoriteChapters['book-1'],
    ).toBeUndefined()
    expect(mockedApi.saveBookFavorites).toHaveBeenLastCalledWith('book-1', [])

    store.toggleChapterFavorite('book-1', 20)
    store.removeBookChapters('book-1')

    expect(
      useProgressStore.getState().favoriteChapters['book-1'],
    ).toBeUndefined()
    expect(mockedApi.removeBookFavorites).toHaveBeenCalledWith('book-1')
  })

  it('keeps existing progress when backend hydration fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockedApi.fetchProgress.mockRejectedValueOnce(new Error('offline'))
    useProgressStore.setState({
      comics: {
        'comic-1': { current: 1, total: 3, percent: 50, lastRead: 100 },
      },
    })

    await useProgressStore.getState().hydrate()

    expect(useProgressStore.getState().comics['comic-1']).toEqual({
      current: 1,
      total: 3,
      percent: 50,
      lastRead: 100,
    })
    expect(console.error).toHaveBeenCalledWith(
      'Failed to fetch progress:',
      expect.any(Error),
    )
  })
})
