import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Author, Book, Comic, Library } from '@/types/library'

interface LibraryState {
  libraries: Library[]
  comics: Comic[]
  authors: Author[]
  books: Book[]
  isScanning: boolean
  selectedLibraryId: string | null // null = show all

  addLibrary: (lib: Library) => void
  removeLibrary: (id: string) => void

  setComics: (comics: Comic[]) => void
  addComics: (comics: Comic[]) => void

  setAuthors: (authors: Author[]) => void
  addAuthors: (authors: Author[]) => void

  setBooks: (books: Book[]) => void
  addBooks: (books: Book[]) => void

  setScanning: (isScanning: boolean) => void
  setSelectedLibrary: (id: string | null) => void

  // Helpers
  getComicsByLibrary: (libraryId: string) => Comic[]
  getAuthorsByLibrary: (libraryId: string) => Author[]
  getBooksByAuthor: (authorId: string) => Book[]

  replaceComicsForLibrary: (libraryId: string, comics: Comic[]) => void
  replaceBooksForLibrary: (
    libraryId: string,
    authors: Author[],
    books: Book[],
  ) => void

  updateComicProgress: (
    comicId: string,
    pageIndex: number,
    total: number,
  ) => void

  updateBookProgress: (
    bookId: string,
    progress: { startCharIndex: number; totalChars: number; percent: number },
  ) => void
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      libraries: [],
      comics: [],
      authors: [],
      books: [],
      isScanning: false,
      selectedLibraryId: null,

      addLibrary: (lib) =>
        set((state) => ({
          libraries: [...state.libraries, lib],
        })),

      removeLibrary: (id) =>
        set((state) => ({
          libraries: state.libraries.filter((l) => l.id !== id),
          comics: state.comics.filter((c) => c.libraryId !== id),
          authors: state.authors.filter((a) => a.libraryId !== id),
          books: state.books.filter((b) => b.libraryId !== id),
          // Reset selection if removing selected library
          selectedLibraryId:
            state.selectedLibraryId === id ? null : state.selectedLibraryId,
        })),

      setComics: (comics) => set({ comics }),

      addComics: (newComics) =>
        set((state) => {
          // Avoid duplicates by path
          const existingPaths = new Set(state.comics.map((c) => c.path))
          const uniqueNewComics = newComics.filter(
            (c) => !existingPaths.has(c.path),
          )
          return { comics: [...state.comics, ...uniqueNewComics] }
        }),

      setAuthors: (authors) => set({ authors }),

      addAuthors: (newAuthors) =>
        set((state) => {
          const existingIds = new Set(state.authors.map((a) => a.id))
          const uniqueNew = newAuthors.filter((a) => !existingIds.has(a.id))
          return { authors: [...state.authors, ...uniqueNew] }
        }),

      setBooks: (books) => set({ books }),

      addBooks: (newBooks) =>
        set((state) => {
          // Avoid duplicates by path
          const existingPaths = new Set(state.books.map((b) => b.path))
          const uniqueNew = newBooks.filter((b) => !existingPaths.has(b.path))
          return { books: [...state.books, ...uniqueNew] }
        }),

      setScanning: (isScanning) => set({ isScanning }),

      setSelectedLibrary: (id) => set({ selectedLibraryId: id }),

      getComicsByLibrary: (libraryId) =>
        get().comics.filter((c) => c.libraryId === libraryId),

      getAuthorsByLibrary: (libraryId) =>
        get().authors.filter((a) => a.libraryId === libraryId),

      getBooksByAuthor: (authorId) =>
        get().books.filter((b) => b.authorId === authorId),

      replaceComicsForLibrary: (libraryId, newComics) =>
        set((state) => ({
          comics: [
            ...state.comics.filter((c) => c.libraryId !== libraryId),
            ...newComics,
          ],
        })),

      replaceBooksForLibrary: (libraryId, newAuthors, newBooks) =>
        set((state) => ({
          authors: [
            ...state.authors.filter((a) => a.libraryId !== libraryId),
            ...newAuthors,
          ],
          books: [
            ...state.books.filter((b) => b.libraryId !== libraryId),
            ...newBooks,
          ],
        })),

      updateComicProgress: (comicId, pageIndex, total) =>
        set((state) => ({
          comics: state.comics.map((c) =>
            c.id === comicId
              ? {
                  ...c,
                  progress: {
                    current: pageIndex,
                    total,
                    percent: (pageIndex / (total - 1)) * 100,
                    lastRead: Date.now(),
                  },
                }
              : c,
          ),
        })),

      updateBookProgress: (bookId, progress) =>
        set((state) => ({
          books: state.books.map((b) =>
            b.id === bookId
              ? {
                  ...b,
                  progress: {
                    ...progress,
                    lastRead: Date.now(),
                  },
                }
              : b,
          ),
        })),
    }),
    {
      name: 'eriri-library-storage',
    },
  ),
)
