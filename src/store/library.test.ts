import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/lib/library-api'
import * as scanner from '@/lib/scanner'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import { LibraryType } from '@/types/library'

vi.mock('@/lib/library-api', () => ({
  fetchCatalog: vi.fn(),
  refreshLibrary: vi.fn().mockResolvedValue(undefined),
  removeLibrary: vi.fn().mockResolvedValue(undefined),
  reorderLibraries: vi.fn().mockResolvedValue(undefined),
  setComicTags: vi.fn().mockResolvedValue(true),
  setBookTags: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/scanner', () => ({
  scanComicImages: vi.fn().mockResolvedValue([]),
  setFileTag: vi.fn().mockResolvedValue(true),
}))

const mockedApi = vi.mocked(api)
const mockedScanner = vi.mocked(scanner)

const emptyCatalog = {
  libraries: [],
  comics: [],
  authors: [],
  books: [],
}

describe('library store', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    )
    mockedApi.fetchCatalog.mockResolvedValue(emptyCatalog)
    mockedApi.setBookTags.mockResolvedValue(true)
    mockedApi.setComicTags.mockResolvedValue(true)
    mockedScanner.scanComicImages.mockResolvedValue([])
    mockedScanner.setFileTag.mockResolvedValue(true)
    useLibraryStore.setState(useLibraryStore.getInitialState(), true)
    useProgressStore.setState(useProgressStore.getInitialState(), true)
    useTabsStore.setState(useTabsStore.getInitialState(), true)
    useUIStore.setState(useUIStore.getInitialState(), true)
  })

  it('hydrates a flat catalog into naturally sorted browsing maps', async () => {
    mockedApi.fetchCatalog.mockResolvedValueOnce({
      libraries: [
        {
          id: 'library-1',
          name: 'Comics',
          path: '/library/comics',
          type: LibraryType.comic,
          createdAt: 1,
          sortOrder: 0,
        },
        {
          id: 'library-2',
          name: 'Books',
          path: '/library/books',
          type: LibraryType.book,
          createdAt: 2,
          sortOrder: 1,
        },
      ],
      comics: [
        {
          id: 'comic-10',
          title: 'Comic 10',
          path: '/library/comics/Comic 10',
          cover: '/file?path=10',
          libraryId: 'library-1',
          starred: false,
          deleted: false,
          createdAt: 10,
        },
        {
          id: 'comic-2',
          title: 'Comic 2',
          path: '/library/comics/Comic 2',
          cover: '/file?path=2',
          libraryId: 'library-1',
          starred: false,
          deleted: false,
          createdAt: 2,
        },
      ],
      authors: [
        {
          id: 'author-2',
          name: 'Author 2',
          path: '/library/books/Author 2',
          libraryId: 'library-2',
          bookCount: 1,
        },
        {
          id: 'author-10',
          name: 'Author 10',
          path: '/library/books/Author 10',
          libraryId: 'library-2',
          bookCount: 1,
        },
      ],
      books: [
        {
          id: 'book-10',
          title: 'Book 10',
          path: '/library/books/Author 2/Book 10.txt',
          authorId: 'author-2',
          libraryId: 'library-2',
          starred: false,
          deleted: false,
          size: 100,
          createdAt: 10,
        },
        {
          id: 'book-2',
          title: 'Book 2',
          path: '/library/books/Author 2/Book 2.txt',
          authorId: 'author-2',
          libraryId: 'library-2',
          starred: false,
          deleted: false,
          size: 20,
          createdAt: 2,
        },
      ],
    })

    await useLibraryStore.getState().hydrate()

    expect(useLibraryStore.getState().libraries['library-1']?.name).toBe(
      'Comics',
    )
    expect(useLibraryStore.getState().libraryComics['library-1']).toEqual([
      'comic-2',
      'comic-10',
    ])
    expect(useLibraryStore.getState().libraryAuthors['library-2']).toEqual([
      'author-2',
      'author-10',
    ])
    expect(useLibraryStore.getState().authorBooks['author-2']).toEqual([
      'book-2',
      'book-10',
    ])
  })

  it('keeps existing catalog state when hydration fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockedApi.fetchCatalog.mockRejectedValueOnce(new Error('offline'))
    useLibraryStore.setState({
      libraries: {
        'library-1': {
          id: 'library-1',
          name: 'Existing',
          path: '/library/existing',
          type: LibraryType.comic,
          createdAt: 1,
          sortOrder: 0,
        },
      },
    })

    await useLibraryStore.getState().hydrate()

    expect(useLibraryStore.getState().libraries['library-1']?.name).toBe(
      'Existing',
    )
    expect(console.error).toHaveBeenCalledWith(
      'Failed to fetch catalog:',
      expect.any(Error),
    )
  })

  it('refreshes a library, clears its cached comic images, and resets scanning', async () => {
    mockedApi.fetchCatalog.mockResolvedValueOnce(emptyCatalog)
    useLibraryStore.setState({
      libraryComics: { 'library-1': ['comic-1'] },
      comicImages: {
        'comic-1': { comicId: 'comic-1', images: [], timestamp: 100 },
        'comic-2': { comicId: 'comic-2', images: [], timestamp: 200 },
      },
    })

    await useLibraryStore.getState().refreshLibrary('library-1')

    expect(mockedApi.refreshLibrary).toHaveBeenCalledWith('library-1')
    expect(useLibraryStore.getState().comicImages['comic-1']).toBeUndefined()
    expect(useLibraryStore.getState().comicImages['comic-2']).toBeDefined()
    expect(useUIStore.getState().isScanning).toBe(false)
  })

  it('refreshes a library with no cached comics', async () => {
    await useLibraryStore.getState().refreshLibrary('missing-library')

    expect(mockedApi.refreshLibrary).toHaveBeenCalledWith('missing-library')
    expect(useUIStore.getState().isScanning).toBe(false)
  })

  it('removes a library and clears related tabs, progress, and navigation state', async () => {
    useLibraryStore.setState({
      libraryComics: { 'library-1': ['comic-1'] },
      libraryAuthors: { 'library-1': ['author-1'] },
      authorBooks: { 'author-1': ['book-1'] },
    })
    useTabsStore.setState({
      tabs: [
        { type: LibraryType.comic, id: 'comic-1', title: 'Comic 1' },
        { type: LibraryType.book, id: 'book-2', title: 'Book 2' },
      ],
      activeTab: 'comic-1',
    })
    useProgressStore.setState({
      comics: {
        'comic-1': { current: 1, total: 3, percent: 50, lastRead: 100 },
      },
      books: {
        'book-1': { current: 2, total: 10, percent: 20, lastRead: 200 },
      },
      favoriteChapters: { 'book-1': [0, 2] },
    })
    useUIStore.setState({
      selectedLibraryId: 'library-1',
      navStatus: { 'library-1': { comicId: 'comic-1' } },
    })

    await useLibraryStore.getState().removeLibrary('library-1')

    expect(mockedApi.removeLibrary).toHaveBeenCalledWith('library-1')
    expect(useTabsStore.getState().tabs).toEqual([
      { type: LibraryType.book, id: 'book-2', title: 'Book 2' },
    ])
    expect(useProgressStore.getState().comics['comic-1']).toBeUndefined()
    expect(useProgressStore.getState().books['book-1']).toBeUndefined()
    expect(
      useProgressStore.getState().favoriteChapters['book-1'],
    ).toBeUndefined()
    expect(useUIStore.getState().selectedLibraryId).toBeNull()
    expect(useUIStore.getState().navStatus['library-1']).toBeUndefined()
  })

  it('removes an unselected library even when it has no tracked content', async () => {
    useUIStore.setState({ selectedLibraryId: 'library-2' })

    await useLibraryStore.getState().removeLibrary('library-1')

    expect(mockedApi.removeLibrary).toHaveBeenCalledWith('library-1')
    expect(useUIStore.getState().selectedLibraryId).toBe('library-2')
  })

  it('removes a library even when one tracked author has no books', async () => {
    useLibraryStore.setState({
      libraryAuthors: { 'library-1': ['author-without-books'] },
    })

    await useLibraryStore.getState().removeLibrary('library-1')

    expect(mockedApi.removeLibrary).toHaveBeenCalledWith('library-1')
  })

  it('reorders known libraries optimistically and persists the requested order', () => {
    useLibraryStore.setState({
      libraries: {
        'library-1': {
          id: 'library-1',
          name: 'One',
          path: '/one',
          type: LibraryType.comic,
          createdAt: 1,
          sortOrder: 0,
        },
        'library-2': {
          id: 'library-2',
          name: 'Two',
          path: '/two',
          type: LibraryType.book,
          createdAt: 2,
          sortOrder: 1,
        },
      },
    })

    useLibraryStore
      .getState()
      .reorderLibrary(['library-2', 'missing-library', 'library-1'])

    expect(useLibraryStore.getState().libraries['library-2']?.sortOrder).toBe(0)
    expect(useLibraryStore.getState().libraries['library-1']?.sortOrder).toBe(2)
    expect(mockedApi.reorderLibraries).toHaveBeenCalledWith([
      'library-2',
      'missing-library',
      'library-1',
    ])
  })

  it('updates book and comic tags only after backend success', async () => {
    useLibraryStore.setState({
      books: {
        'book-1': {
          id: 'book-1',
          title: 'Book 1',
          path: '/books/Book 1.txt',
          authorId: 'author-1',
          libraryId: 'library-1',
          starred: false,
          deleted: false,
          size: 100,
          createdAt: 1,
        },
      },
      comics: {
        'comic-1': {
          id: 'comic-1',
          title: 'Comic 1',
          path: '/comics/Comic 1',
          cover: '/file?path=cover',
          libraryId: 'library-1',
          starred: false,
          deleted: false,
          createdAt: 1,
        },
        'comic-2': {
          id: 'comic-2',
          title: 'Comic 2',
          path: '/comics/Comic 2',
          cover: '/file?path=cover2',
          libraryId: 'library-1',
          starred: false,
          deleted: false,
          createdAt: 2,
        },
      },
    })
    mockedApi.setComicTags.mockResolvedValueOnce(false)

    await useLibraryStore
      .getState()
      .updateBookTags('book-1', { starred: true, deleted: true })
    await useLibraryStore
      .getState()
      .updateBookTags('book-1', { deleted: false })
    await useLibraryStore
      .getState()
      .updateBookTags('book-1', { starred: false })
    await useLibraryStore
      .getState()
      .updateComicTags('comic-1', { deleted: true })
    await useLibraryStore
      .getState()
      .updateComicTags('comic-2', { starred: true, deleted: true })
    await useLibraryStore
      .getState()
      .updateComicTags('comic-2', { deleted: false })
    await useLibraryStore
      .getState()
      .updateComicTags('comic-2', { starred: false })
    await useLibraryStore
      .getState()
      .updateBookTags('missing-book', { starred: true })
    await useLibraryStore
      .getState()
      .updateComicTags('missing-comic', { starred: true })

    expect(useLibraryStore.getState().books['book-1']?.starred).toBe(false)
    expect(useLibraryStore.getState().books['book-1']?.deleted).toBe(false)
    expect(useLibraryStore.getState().comics['comic-1']?.deleted).toBe(false)
    expect(useLibraryStore.getState().comics['comic-2']?.starred).toBe(false)
    expect(useLibraryStore.getState().comics['comic-2']?.deleted).toBe(false)
    expect(mockedApi.setBookTags).toHaveBeenCalledTimes(3)
  })

  it('keeps book tags unchanged when the backend rejects the update', async () => {
    mockedApi.setBookTags.mockResolvedValueOnce(false)
    useLibraryStore.setState({
      books: {
        'book-1': {
          id: 'book-1',
          title: 'Book 1',
          path: '/books/Book 1.txt',
          authorId: 'author-1',
          libraryId: 'library-1',
          starred: false,
          deleted: false,
          size: 100,
          createdAt: 1,
        },
      },
    })

    await useLibraryStore.getState().updateBookTags('book-1', { starred: true })

    expect(useLibraryStore.getState().books['book-1']?.starred).toBe(false)
  })

  it('does not fail if catalog items disappear while tag writes are in flight', async () => {
    useLibraryStore.setState({
      books: {
        'book-1': {
          id: 'book-1',
          title: 'Book 1',
          path: '/books/Book 1.txt',
          authorId: 'author-1',
          libraryId: 'library-1',
          starred: false,
          deleted: false,
          size: 100,
          createdAt: 1,
        },
      },
      comics: {
        'comic-1': {
          id: 'comic-1',
          title: 'Comic 1',
          path: '/comics/Comic 1',
          cover: '/file?path=cover',
          libraryId: 'library-1',
          starred: false,
          deleted: false,
          createdAt: 1,
        },
      },
    })
    mockedApi.setBookTags.mockImplementationOnce(() => {
      useLibraryStore.setState({ books: {} })
      return Promise.resolve(true)
    })
    mockedApi.setComicTags.mockImplementationOnce(() => {
      useLibraryStore.setState({ comics: {} })
      return Promise.resolve(true)
    })

    await useLibraryStore.getState().updateBookTags('book-1', { starred: true })
    await useLibraryStore
      .getState()
      .updateComicTags('comic-1', { starred: true })

    expect(useLibraryStore.getState().books['book-1']).toBeUndefined()
    expect(useLibraryStore.getState().comics['comic-1']).toBeUndefined()
  })

  it('scans comic images once, updates image tags, and reuses the image cache', async () => {
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'))
    const image = {
      path: '/comics/Comic 1/1.jpg',
      url: '/file?path=1',
      thumbnail: '/file?path=thumb1',
      filename: '1.jpg',
      starred: false,
      deleted: false,
      width: 100,
      height: 200,
      index: 0,
    }
    mockedScanner.scanComicImages.mockResolvedValueOnce([image])
    useLibraryStore.setState({
      comics: {
        'comic-1': {
          id: 'comic-1',
          title: 'Comic 1',
          path: '/comics/Comic 1',
          cover: '/file?path=cover',
          libraryId: 'library-1',
          starred: false,
          deleted: false,
          createdAt: 1,
        },
      },
    })

    await expect(
      useLibraryStore.getState().getComicImages('missing-comic'),
    ).resolves.toEqual([])

    await expect(
      useLibraryStore.getState().getComicImages('comic-1'),
    ).resolves.toEqual([image])
    expect(useLibraryStore.getState().comics['comic-1']?.pageCount).toBe(1)
    expect(useUIStore.getState().isScanning).toBe(false)

    await useLibraryStore
      .getState()
      .updateComicImageTags('comic-1', '1.jpg', { starred: true })

    expect(mockedScanner.setFileTag).toHaveBeenCalledWith(
      '/comics/Comic 1/1.jpg',
      {
        starred: true,
      },
    )
    expect(
      useLibraryStore.getState().comicImages['comic-1']?.images[0]?.starred,
    ).toBe(true)

    await expect(
      useLibraryStore.getState().getComicImages('comic-1'),
    ).resolves.toEqual([{ ...image, starred: true }])
    expect(mockedScanner.scanComicImages).toHaveBeenCalledTimes(1)
  })

  it('ignores comic image tag updates when the image is missing or the backend rejects it', async () => {
    useLibraryStore.setState({
      comicImages: {
        'comic-1': {
          comicId: 'comic-1',
          timestamp: 100,
          images: [
            {
              path: '/comics/Comic 1/1.jpg',
              url: '/file?path=1',
              thumbnail: '/file?path=thumb1',
              filename: '1.jpg',
              starred: false,
              deleted: false,
              width: 100,
              height: 200,
              index: 0,
            },
          ],
        },
      },
    })
    mockedScanner.setFileTag.mockResolvedValueOnce(false)

    await useLibraryStore
      .getState()
      .updateComicImageTags('missing-comic', '1.jpg', { starred: true })
    await useLibraryStore
      .getState()
      .updateComicImageTags('comic-1', 'missing.jpg', { starred: true })
    await useLibraryStore.getState().updateComicImageTags('comic-1', '1.jpg', {
      starred: true,
      deleted: true,
    })

    expect(
      useLibraryStore.getState().comicImages['comic-1']?.images[0],
    ).toMatchObject({
      starred: false,
      deleted: false,
    })
  })

  it('updates only the provided comic image tag fields after a successful write', async () => {
    useLibraryStore.setState({
      comicImages: {
        'comic-1': {
          comicId: 'comic-1',
          timestamp: 100,
          images: [
            {
              path: '/comics/Comic 1/1.jpg',
              url: '/file?path=1',
              thumbnail: '/file?path=thumb1',
              filename: '1.jpg',
              starred: false,
              deleted: false,
              width: 100,
              height: 200,
              index: 0,
            },
          ],
        },
      },
    })

    await useLibraryStore
      .getState()
      .updateComicImageTags('comic-1', '1.jpg', { deleted: true })
    await useLibraryStore
      .getState()
      .updateComicImageTags('comic-1', '1.jpg', { starred: true })

    expect(
      useLibraryStore.getState().comicImages['comic-1']?.images[0],
    ).toMatchObject({
      starred: true,
      deleted: true,
    })
  })

  it('does not fail if cached comic images disappear while tag writes are in flight', async () => {
    useLibraryStore.setState({
      comicImages: {
        'comic-1': {
          comicId: 'comic-1',
          timestamp: 100,
          images: [
            {
              path: '/comics/Comic 1/1.jpg',
              url: '/file?path=1',
              thumbnail: '/file?path=thumb1',
              filename: '1.jpg',
              starred: false,
              deleted: false,
              width: 100,
              height: 200,
              index: 0,
            },
          ],
        },
      },
    })
    mockedScanner.setFileTag.mockImplementationOnce(() => {
      useLibraryStore.setState({ comicImages: {} })
      return Promise.resolve(true)
    })

    await useLibraryStore
      .getState()
      .updateComicImageTags('comic-1', '1.jpg', { starred: true })

    expect(useLibraryStore.getState().comicImages['comic-1']).toBeUndefined()
  })

  it('does not fail if a cached image disappears while tag writes are in flight', async () => {
    useLibraryStore.setState({
      comicImages: {
        'comic-1': {
          comicId: 'comic-1',
          timestamp: 100,
          images: [
            {
              path: '/comics/Comic 1/1.jpg',
              url: '/file?path=1',
              thumbnail: '/file?path=thumb1',
              filename: '1.jpg',
              starred: false,
              deleted: false,
              width: 100,
              height: 200,
              index: 0,
            },
          ],
        },
      },
    })
    mockedScanner.setFileTag.mockImplementationOnce(() => {
      useLibraryStore.setState({
        comicImages: {
          'comic-1': { comicId: 'comic-1', timestamp: 100, images: [] },
        },
      })
      return Promise.resolve(true)
    })

    await useLibraryStore
      .getState()
      .updateComicImageTags('comic-1', '1.jpg', { starred: true })

    expect(useLibraryStore.getState().comicImages['comic-1']?.images).toEqual(
      [],
    )
  })

  it('evicts the oldest cached comic images after the cache grows past its limit', async () => {
    const cachedImages = Object.fromEntries(
      Array.from({ length: 31 }, (_, index) => [
        `comic-${index}`,
        { comicId: `comic-${index}`, images: [], timestamp: index },
      ]),
    )
    useLibraryStore.setState({
      comics: {
        'comic-new': {
          id: 'comic-new',
          title: 'Comic New',
          path: '/comics/New',
          cover: '/file?path=cover',
          libraryId: 'library-1',
          starred: false,
          deleted: false,
          createdAt: 1,
        },
      },
      comicImages: cachedImages,
    })

    await useLibraryStore.getState().getComicImages('comic-new')

    expect(useLibraryStore.getState().comicImages['comic-new']).toBeDefined()
    expect(useLibraryStore.getState().comicImages['comic-0']).toBeUndefined()
    expect(useLibraryStore.getState().comicImages['comic-30']).toBeDefined()
  })

  it('does not set page count if a comic disappears while images are loading', async () => {
    mockedScanner.scanComicImages.mockImplementationOnce(() => {
      useLibraryStore.setState({ comics: {} })
      return Promise.resolve([])
    })
    useLibraryStore.setState({
      comics: {
        'comic-1': {
          id: 'comic-1',
          title: 'Comic 1',
          path: '/comics/Comic 1',
          cover: '/file?path=cover',
          libraryId: 'library-1',
          starred: false,
          deleted: false,
          createdAt: 1,
        },
      },
    })

    await useLibraryStore.getState().getComicImages('comic-1')

    expect(useLibraryStore.getState().comics['comic-1']).toBeUndefined()
  })
})
