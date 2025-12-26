import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { scanComicImages } from '@/lib/scanner'
import { createIDBStorage } from '@/lib/storage'
import type { Author, Book, Comic, Image, Library } from '@/types/library'

const MAX_CACHE_SIZE = 30

interface ComicImageCache {
  comicId: string
  images: Image[]
  timestamp: number
}

interface LibraryState {
  libraries: Library[]
  getLibrary: (id: string) => Library | undefined
  addLibrary: (lib: Library) => void
  removeLibrary: (id: string) => void
  updateLibrary: (id: string, data: Partial<Library>) => void
  updateLibraryComicOrAuthor: (
    id: string,
    data: { comics?: Comic[]; authors?: Author[] },
  ) => void

  selectedLibraryId: string | null
  setSelectedLibraryId: (id: string | null) => void

  isScanning: boolean
  setScanning: (isScanning: boolean) => void

  findComic: (libraryId: string, comicId: string) => Comic | undefined
  findBook: (
    libraryId: string,
    authorId: string,
    bookId: string,
  ) => Book | undefined

  comicImagesCache: ComicImageCache[]
  getComicImages: (libraryId: string, comicId: string) => Promise<Image[]>
  addComicImages: (comicId: string, images: Image[]) => void
  removeComicImages: (comicId: string) => void

  updateBookStarred: (
    libraryId: string,
    authorId: string,
    bookId: string,
    starred: boolean,
  ) => void

  updateComicStarred: (
    libraryId: string,
    comicId: string,
    starred: boolean,
  ) => void

  updateComicImageStarred: (
    comicId: string,
    filename: string,
    starred: boolean,
  ) => void

  updateComicProgress: (
    libraryId: string,
    comicId: string,
    pageIndex: number,
    total: number,
  ) => void

  updateBookProgress: (
    libraryId: string,
    authorId: string,
    bookId: string,
    progress: { startCharIndex: number; totalChars: number; percent: number },
  ) => void
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    immer((set, get) => ({
      libraries: [],
      comicImagesCache: [],
      selectedLibraryId: null,
      isScanning: false,

      getLibrary: (id) => get().libraries.find((l) => l.id === id),

      addLibrary: (lib) =>
        set((state) => {
          state.libraries.push(lib)
        }),

      removeLibrary: (id) =>
        set((state) => {
          state.libraries = state.libraries.filter((l) => l.id !== id)
          if (state.selectedLibraryId === id) {
            state.selectedLibraryId = null
          }
        }),

      updateLibrary: (id, data) =>
        set((state) => {
          const lib = state.libraries.find((l) => l.id === id)
          if (lib) {
            Object.assign(lib, data)
          }
        }),

      setSelectedLibraryId: (id) => set({ selectedLibraryId: id }),
      setScanning: (isScanning) => set({ isScanning }),

      findComic: (libraryId, comicId) => {
        const lib = get().libraries.find((l) => l.id === libraryId)
        return lib?.comics?.find((c) => c.id === comicId)
      },

      findBook: (libraryId, authorId, bookId) => {
        const lib = get().libraries.find((l) => l.id === libraryId)
        const author = lib?.authors?.find((a) => a.id === authorId)
        return author?.books?.find((b) => b.id === bookId)
      },

      updateComicProgress: (libraryId, comicId, pageIndex, total) =>
        set((state) => {
          const lib = state.libraries.find((l) => l.id === libraryId)
          const comic = lib?.comics?.find((c) => c.id === comicId)

          if (comic) {
            comic.progress = {
              current: pageIndex,
              total,
              percent: (pageIndex / (total - 1)) * 100,
              lastRead: Date.now(),
            }
          }
        }),

      updateBookProgress: (libraryId, authorId, bookId, progress) =>
        set((state) => {
          const lib = state.libraries.find((l) => l.id === libraryId)
          const author = lib?.authors?.find((a) => a.id === authorId)
          const book = author?.books?.find((b) => b.id === bookId)

          if (book) {
            book.progress = {
              ...progress,
              lastRead: Date.now(),
            }
          }
        }),

      updateBookStarred: (libraryId, authorId, bookId, starred) =>
        set((state) => {
          const lib = state.libraries.find((l) => l.id === libraryId)
          const author = lib?.authors?.find((a) => a.id === authorId)
          const book = author?.books?.find((b) => b.id === bookId)
          if (book) book.starred = starred
        }),

      updateComicStarred: (libraryId, comicId, starred) =>
        set((state) => {
          const lib = state.libraries.find((l) => l.id === libraryId)
          const comic = lib?.comics?.find((c) => c.id === comicId)
          if (comic) comic.starred = starred
        }),

      updateComicImageStarred: (comicId, filename, starred) =>
        set((state) => {
          const cache = state.comicImagesCache.find(
            (c) => c.comicId === comicId,
          )
          const image = cache?.images.find((i) => i.filename === filename)
          if (image) image.starred = starred
        }),

      updateLibraryComicOrAuthor: (id, { comics, authors }) =>
        set((state) => {
          const lib = state.libraries.find((l) => l.id === id)
          if (!lib) return

          if (comics) {
            const existingComicsMap = new Map(lib.comics?.map((c) => [c.id, c]))

            lib.comics = comics.map((newComic) => {
              const existing = existingComicsMap.get(newComic.id)
              if (existing?.progress) {
                newComic.progress = existing.progress
                newComic.starred = existing.starred
              }
              return newComic
            })

            const newComicIds = new Set(comics.map((c) => c.id))
            state.comicImagesCache = state.comicImagesCache.filter(
              (cache) => !newComicIds.has(cache.comicId),
            )
          }

          if (authors) {
            const existingAuthorsMap = new Map(
              lib.authors?.map((a) => [a.id, a]),
            )

            lib.authors = authors.map((newAuthor) => {
              const existingAuthor = existingAuthorsMap.get(newAuthor.id)
              if (!existingAuthor?.books) return newAuthor

              const existingBooksMap = new Map(
                existingAuthor.books.map((b) => [b.id, b]),
              )

              if (newAuthor.books) {
                newAuthor.books = newAuthor.books.map((newBook) => {
                  const existingBook = existingBooksMap.get(newBook.id)
                  if (existingBook?.progress) {
                    newBook.progress = existingBook.progress
                    newBook.starred = existingBook.starred
                  }
                  return newBook
                })
              }
              return newAuthor
            })
          }
        }),

      getComicImages: async (libraryId, comicId) => {
        const cache = get().comicImagesCache.find((c) => c.comicId === comicId)

        if (cache) {
          set((state) => {
            const item = state.comicImagesCache.find(
              (c) => c.comicId === comicId,
            )
            if (item) item.timestamp = Date.now()
          })
          return cache.images
        }

        const comic = get().findComic(libraryId, comicId)
        if (!comic) return []

        try {
          const images = await scanComicImages(comic.path)

          set((state) => {
            state.comicImagesCache.push({
              comicId,
              images,
              timestamp: Date.now(),
            })

            if (state.comicImagesCache.length > MAX_CACHE_SIZE) {
              state.comicImagesCache.sort((a, b) => b.timestamp - a.timestamp)
              state.comicImagesCache.length = MAX_CACHE_SIZE
            }

            const lib = state.libraries.find((l) => l.id === libraryId)
            const c = lib?.comics?.find((item) => item.id === comicId)
            if (c) {
              c.pageCount = images.length
            }
          })

          return images
        } catch (error) {
          console.error('Failed to scan comic images:', error)
          return []
        }
      },

      addComicImages: (comicId, images) =>
        set((state) => {
          const cacheIndex = state.comicImagesCache.findIndex(
            (c) => c.comicId === comicId,
          )
          const newItem = { comicId, images, timestamp: Date.now() }

          if (cacheIndex !== -1) {
            state.comicImagesCache[cacheIndex] = newItem
          } else {
            state.comicImagesCache.push(newItem)
          }

          if (state.comicImagesCache.length > MAX_CACHE_SIZE) {
            state.comicImagesCache.sort((a, b) => b.timestamp - a.timestamp)
            state.comicImagesCache.length = MAX_CACHE_SIZE
          }
        }),

      removeComicImages: (comicId) =>
        set((state) => {
          state.comicImagesCache = state.comicImagesCache.filter(
            (c) => c.comicId !== comicId,
          )
        }),
    })),
    {
      name: 'eriri-library-storage',
      storage: createJSONStorage(() => createIDBStorage()),
    },
  ),
)
