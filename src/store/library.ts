import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import {
  generateUuid,
  isBookLibrary,
  scanBookLibrary,
  scanComicImages,
  scanComicLibrary,
} from '@/lib/scanner'
import { createIDBStorage } from '@/lib/storage'
import {
  LibraryType,
  type Author,
  type Book,
  type Comic,
  type ComicImage,
  type FileTags,
  type Image,
  type Library,
  type ScannedLibrary,
} from '@/types/library'

const MAX_CACHE_SIZE = 30

interface LibraryState {
  libraries: Record<string, Library>
  comics: Record<string, Comic>
  authors: Record<string, Author>
  books: Record<string, Book>

  libraryComics: Record<string, string[]>
  libraryAuthors: Record<string, string[]>
  authorBooks: Record<string, string[]>
  comicImages: Record<string, ComicImage>

  addLibrary: (library: Library, scannedLibrary: ScannedLibrary) => void
  updateLibrary: (
    id: string,
    data: Partial<Library>,
    scannedLibrary?: ScannedLibrary,
  ) => void
  removeLibrary: (id: string) => void
  importLibrary: (path: string) => Promise<void>
  refreshLibrary: (libraryId: string) => Promise<void>

  selectedLibraryId: string | null
  setSelectedLibraryId: (id: string | null) => void

  isScanning: boolean
  setScanning: (isScanning: boolean) => void

  getComicImages: (comicId: string) => Promise<Image[]>
  addComicImages: (comicId: string, images: Image[]) => void
  removeComicImages: (comicId: string) => void

  updateBookTags: (bookId: string, tags: FileTags) => void
  updateComicTags: (comicId: string, tags: FileTags) => void
  updateComicImageTags: (
    comicId: string,
    filename: string,
    tags: FileTags,
  ) => void

  // updateBookStarred: (bookId: string, starred: boolean) => void
  // updateBookDeleted: (bookId: string, deleted: boolean) => void
  // updateComicStarred: (comicId: string, starred: boolean) => void
  // updateComicDeleted: (comicId: string, deleted: boolean) => void
  // updateComicImageStarred: (
  //   comicId: string,
  //   filename: string,
  //   starred: boolean,
  // ) => void
  // updateComicImageDeleted: (
  //   comicId: string,
  //   filename: string,
  //   deleted: boolean,
  // ) => void
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    immer((set, get) => ({
      libraries: {},
      comics: {},
      authors: {},
      books: {},
      libraryComics: {},
      libraryAuthors: {},
      authorBooks: {},
      comicImages: {},
      selectedLibraryId: null,
      isScanning: false,

      addLibrary: (library, scannedLibrary) =>
        set((state) => {
          const { comics = [], authors = [] } = scannedLibrary
          state.libraries[library.id] = library

          const comicIds: string[] = []
          comics.forEach((c) => {
            state.comics[c.id] = c
            comicIds.push(c.id)
          })
          state.libraryComics[library.id] = comicIds

          const authorIds: string[] = []
          authors.forEach((a) => {
            const { books = [], ...authorInfo } = a
            state.authors[a.id] = authorInfo
            authorIds.push(a.id)

            const bookIds: string[] = []
            books.forEach((b) => {
              state.books[b.id] = b
              bookIds.push(b.id)
            })
            state.authorBooks[a.id] = bookIds
          })
          state.libraryAuthors[library.id] = authorIds
        }),

      updateLibrary: (id, data, scannedLibrary) =>
        set((state) => {
          const library = state.libraries[id]
          if (library) {
            Object.assign(library, data)
          }

          if (!scannedLibrary) return

          const { comics = [], authors = [] } = scannedLibrary
          state.libraries[library.id] = library

          const comicIds: string[] = []
          comics.forEach((c) => {
            state.comics[c.id] = c
            comicIds.push(c.id)
          })
          state.libraryComics[library.id] = comicIds

          const authorIds: string[] = []
          authors.forEach((a) => {
            const { books = [], ...authorInfo } = a
            state.authors[a.id] = authorInfo
            authorIds.push(a.id)

            const bookIds: string[] = []
            books.forEach((b) => {
              state.books[b.id] = b
              bookIds.push(b.id)
            })
            state.authorBooks[a.id] = bookIds
          })
          state.libraryAuthors[library.id] = authorIds
        }),

      removeLibrary: (id) =>
        set((state) => {
          const comicIds = state.libraryComics[id] ?? []
          const authorIds = state.libraryAuthors[id] ?? []
          const bookIds = authorIds.flatMap(
            (aId) => state.authorBooks[aId] ?? [],
          )

          comicIds.forEach((cId) => {
            delete state.comics[cId]
            delete state.comicImages[cId]
          })

          authorIds.forEach((aId) => {
            delete state.authors[aId]
            delete state.authorBooks[aId]
          })

          bookIds.forEach((bId) => delete state.books[bId])

          delete state.libraryComics[id]
          delete state.libraryAuthors[id]
          delete state.libraries[id]

          if (state.selectedLibraryId === id) {
            state.selectedLibraryId = ''
          }
        }),

      importLibrary: async (path) => {
        set({ isScanning: true })
        try {
          const libraryId = await generateUuid(path)
          const existingLibrary = get().libraries[libraryId]
          if (existingLibrary) return

          const isBook = await isBookLibrary(path)
          const libraryName = path.split('/').pop() ?? 'Untitled Library'

          const library: Library = {
            id: libraryId,
            name: libraryName,
            path,
            type: isBook ? LibraryType.book : LibraryType.comic,
            createdAt: Date.now(),
            status: {
              comicId: '',
              authorId: '',
              bookId: '',
            },
          }

          const scannedLibrary: ScannedLibrary = {}
          if (isBook) {
            scannedLibrary.authors = await scanBookLibrary(path, libraryId)
          } else {
            scannedLibrary.comics = await scanComicLibrary(path, libraryId)
          }

          get().addLibrary(library, scannedLibrary)
        } finally {
          set({ isScanning: false })
        }
      },

      refreshLibrary: async (id) => {
        const lib = get().libraries[id]
        if (!lib) return

        set({ isScanning: true })
        try {
          const scannedLibrary: ScannedLibrary = {}
          if (lib.type === LibraryType.book) {
            scannedLibrary.authors = await scanBookLibrary(lib.path, lib.id)
          } else {
            scannedLibrary.comics = await scanComicLibrary(lib.path, lib.id)
          }
          get().updateLibrary(id, {}, scannedLibrary)
        } finally {
          set({ isScanning: false })
        }
      },

      setSelectedLibraryId: (id) => set({ selectedLibraryId: id }),

      setScanning: (isScanning) => set({ isScanning }),

      updateBookTags: (bookId, tags) =>
        set((state) => {
          const book = state.books[bookId]
          if (book) {
            Object.assign(book, tags)
          }
        }),

      updateComicTags: (comicId, tags) =>
        set((state) => {
          const comic = state.comics[comicId]
          if (comic) {
            Object.assign(comic, tags)
          }
        }),

      updateComicImageTags: (comicId, filename, tags) =>
        set((state) => {
          const comicImages = state.comicImages[comicId]
          const image = comicImages.images.find((i) => i.filename === filename)
          if (image) {
            Object.assign(image, tags)
          }
        }),

      getComicImages: async (comicId) => {
        const cache = get().comicImages[comicId]

        if (cache) {
          set((state) => {
            const item = state.comicImages[comicId]
            if (item) {
              item.timestamp = Date.now()
            }
          })
          return cache.images
        }

        const comic = get().comics[comicId]
        if (!comic) return []

        try {
          const images = await scanComicImages(comic.path)

          set((state) => {
            state.comicImages[comicId] = {
              comicId,
              images,
              timestamp: Date.now(),
            }

            if (Object.keys(state.comicImages).length > MAX_CACHE_SIZE) {
              const sortedCaches = Object.values(state.comicImages).sort(
                (a, b) => a.timestamp - b.timestamp,
              )
              // Remove surplus + buffer to prevent frequent cleaning
              const itemsToRemove = sortedCaches.slice(
                0,
                sortedCaches.length - MAX_CACHE_SIZE + 5,
              )
              itemsToRemove.forEach((item) => {
                delete state.comicImages[item.comicId]
              })
            }
            const c = state.comics[comicId]
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
          const newItem = { comicId, images, timestamp: Date.now() }
          state.comicImages[comicId] = newItem
        }),

      removeComicImages: (comicId) =>
        set((state) => {
          delete state.comicImages[comicId]
        }),
    })),
    {
      name: 'eriri-library-storage',
      storage: createJSONStorage(() => createIDBStorage()),
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { isScanning, ...persistedState } = state
        return persistedState
      },
    },
  ),
)
