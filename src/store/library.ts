import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { scanComicImages } from '@/lib/scanner'
import type { Author, Book, Comic, Image, Library } from '@/types/library'

const MAX_CACHE_SIZE = 20

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
    (set, get) => ({
      libraries: [],
      comicImagesCache: [],
      selectedLibraryId: null,
      isScanning: false,

      getLibrary: (id) => get().libraries.find((l) => l.id === id),

      addLibrary: (lib) =>
        set((state) => ({
          libraries: [...state.libraries, lib],
        })),

      removeLibrary: (id) =>
        set((state) => ({
          libraries: state.libraries.filter((l) => l.id !== id),
          selectedLibraryId:
            state.selectedLibraryId === id ? null : state.selectedLibraryId,
        })),

      updateLibrary: (id, data) =>
        set((state) => {
          return {
            libraries: state.libraries.map((lib) =>
              lib.id === id ? { ...lib, ...data } : lib,
            ),
          }
        }),

      setSelectedLibraryId: (id) => set({ selectedLibraryId: id }),

      setScanning: (isScanning) => set({ isScanning }),

      findComic: (libraryId, comicId) => {
        const lib = get().libraries.find((l) => l.id === libraryId)
        if (!lib?.comics) return undefined
        return lib.comics.find((c) => c.id === comicId)
      },

      findBook: (libraryId, authorId, bookId) => {
        const lib = get().libraries.find((l) => l.id === libraryId)
        if (!lib?.authors) return undefined

        const author = lib.authors.find((a) => a.id === authorId)
        if (!author?.books) return undefined

        return author.books.find((b) => b.id === bookId)
      },

      updateComicProgress: (libraryId, comicId, pageIndex, total) =>
        set((state) => {
          const libraryIndex = state.libraries.findIndex(
            (l) => l.id === libraryId,
          )
          if (libraryIndex === -1) return state

          const lib = state.libraries[libraryIndex]
          if (!lib.comics) return state

          const comicIndex = lib.comics.findIndex((c) => c.id === comicId)
          if (comicIndex === -1) return state

          const newComics = [...lib.comics]
          newComics[comicIndex] = {
            ...newComics[comicIndex],
            progress: {
              current: pageIndex,
              total,
              percent: (pageIndex / (total - 1)) * 100,
              lastRead: Date.now(),
            },
          }

          const updatedLib = { ...lib, comics: newComics }
          const newLibraries = [...state.libraries]
          newLibraries[libraryIndex] = updatedLib

          return { libraries: newLibraries }
        }),

      updateBookProgress: (libraryId, authorId, bookId, progress) =>
        set((state) => {
          const libraryIndex = state.libraries.findIndex(
            (l) => l.id === libraryId,
          )
          if (libraryIndex === -1) return state

          const lib = state.libraries[libraryIndex]
          if (!lib.authors) return state

          const authorIndex = lib.authors.findIndex((a) => a.id === authorId)
          if (authorIndex === -1) return state

          const author = lib.authors[authorIndex]
          if (!author.books) return state

          const bookIndex = author.books.findIndex((b) => b.id === bookId)
          if (bookIndex === -1) return state

          const newBooks = [...author.books]
          newBooks[bookIndex] = {
            ...newBooks[bookIndex],
            progress: {
              ...progress,
              lastRead: Date.now(),
            },
          }

          const newAuthors = [...lib.authors]
          newAuthors[authorIndex] = {
            ...author,
            books: newBooks,
          }

          const updatedLib = { ...lib, authors: newAuthors }
          const newLibraries = [...state.libraries]
          newLibraries[libraryIndex] = updatedLib

          return { libraries: newLibraries }
        }),

      updateLibraryComicOrAuthor: (id, { comics, authors }) =>
        set((state) => {
          const libraryIndex = state.libraries.findIndex((l) => l.id === id)
          if (libraryIndex === -1) return state

          const currentLib = state.libraries[libraryIndex]
          const updatedLib = { ...currentLib }

          if (comics) {
            // Merge comics preserving progress
            updatedLib.comics = comics.map((newComic) => {
              const existingComic = currentLib.comics?.find(
                (c) => c.id === newComic.id,
              )
              if (existingComic?.progress) {
                return { ...newComic, progress: existingComic.progress }
              }
              return newComic
            })
          }

          if (authors) {
            // Merge authors and their books preserving progress
            updatedLib.authors = authors.map((newAuthor) => {
              const existingAuthor = currentLib.authors?.find(
                (a) => a.id === newAuthor.id,
              )

              if (!existingAuthor?.books) {
                return newAuthor
              }

              const updatedBooks = newAuthor.books?.map((newBook) => {
                const existingBook = existingAuthor.books?.find(
                  (b) => b.id === newBook.id,
                )
                if (existingBook?.progress) {
                  return { ...newBook, progress: existingBook.progress }
                }
                return newBook
              })

              return { ...newAuthor, books: updatedBooks }
            })
          }

          const newLibraries = [...state.libraries]
          newLibraries[libraryIndex] = updatedLib

          return { libraries: newLibraries }
        }),

      getComicImages: async (libraryId, comicId) => {
        const cache = get().comicImagesCache
        const item = cache.find((c) => c.comicId === comicId)
        if (item) {
          set((state) => ({
            comicImagesCache: state.comicImagesCache.map((c) =>
              c.comicId === comicId ? { ...c, timestamp: Date.now() } : c,
            ),
          }))
          return item.images
        }

        const comic = get().findComic(libraryId, comicId)
        if (!comic) return []

        try {
          const images = await scanComicImages(comic.path)
          console.log('images---', images)
          get().addComicImages(comicId, images)
          return images
        } catch (error) {
          console.error('Failed to scan comic images:', error)
          return []
        }
      },

      addComicImages: (comicId, images) =>
        set((state) => {
          let newCache = [...state.comicImagesCache]
          const existingIndex = newCache.findIndex((c) => c.comicId === comicId)

          if (existingIndex !== -1) {
            newCache[existingIndex] = { comicId, images, timestamp: Date.now() }
          } else {
            newCache.push({ comicId, images, timestamp: Date.now() })
          }

          if (newCache.length > MAX_CACHE_SIZE) {
            newCache.sort((a, b) => b.timestamp - a.timestamp)
            newCache = newCache.slice(0, MAX_CACHE_SIZE)
          }

          return { comicImagesCache: newCache }
        }),

      removeComicImages: (comicId) =>
        set((state) => ({
          comicImagesCache: state.comicImagesCache.filter(
            (c) => c.comicId !== comicId,
          ),
        })),
    }),
    {
      name: 'eriri-library-storage',
    },
  ),
)
