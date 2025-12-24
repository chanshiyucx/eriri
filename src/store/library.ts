import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Book, Comic, Library } from '@/types/library'

interface LibraryState {
  libraries: Library[]
  getLibrary: (id: string) => Library | undefined
  addLibrary: (lib: Library) => void
  removeLibrary: (id: string) => void
  updateLibrary: (id: string, data: Partial<Library>) => void

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
          console.log('updateLibrary---', id, data)
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
    }),
    {
      name: 'eriri-library-storage',
    },
  ),
)
