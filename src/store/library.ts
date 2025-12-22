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
  libraryStates: Record<
    string,
    {
      selectedAuthorId: string | null
      selectedBookId: string | null
      selectedComicId: string | null
    }
  >

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
  setLibraryState: (
    libraryId: string,
    state: Partial<{
      selectedAuthorId: string | null
      selectedBookId: string | null
      selectedComicId: string | null
    }>,
  ) => void

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

  // Library validation
  validateAllLibraries: () => Promise<void>
  markLibraryInvalid: (id: string, reason: string) => void
  markLibraryValid: (id: string) => void
  reconnectLibrary: (id: string) => Promise<boolean>
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
      libraryStates: {},

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
          libraryStates: Object.fromEntries(
            Object.entries(state.libraryStates).filter(([key]) => key !== id),
          ),
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

      setLibraryState: (libraryId, newState) =>
        set((state) => ({
          libraryStates: {
            ...state.libraryStates,
            [libraryId]: {
              ...(state.libraryStates[libraryId] || {
                selectedAuthorId: null,
                selectedBookId: null,
                selectedComicId: null,
              }),
              ...newState,
            },
          },
        })),

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

      // Library validation actions
      validateAllLibraries: async () => {
        const { libraries } = get()
        const { validateLibraries: validateFn } =
          await import('@/lib/libraryValidator')

        const validationResults = await validateFn(
          libraries.map((l) => ({ id: l.id, path: l.path })),
        )

        set((state) => ({
          libraries: state.libraries.map((lib) => {
            const result = validationResults.get(lib.id)
            if (!result) return lib

            return {
              ...lib,
              isValid: result.isValid,
              lastValidated: Date.now(),
              invalidReason: result.reason,
            }
          }),
        }))
      },

      markLibraryInvalid: (id, reason) =>
        set((state) => ({
          libraries: state.libraries.map((lib) =>
            lib.id === id
              ? {
                  ...lib,
                  isValid: false,
                  lastValidated: Date.now(),
                  invalidReason: reason,
                }
              : lib,
          ),
        })),

      markLibraryValid: (id) =>
        set((state) => ({
          libraries: state.libraries.map((lib) =>
            lib.id === id
              ? {
                  ...lib,
                  isValid: true,
                  lastValidated: Date.now(),
                  invalidReason: undefined,
                }
              : lib,
          ),
        })),

      reconnectLibrary: async (id) => {
        const { libraries } = get()
        const library = libraries.find((l) => l.id === id)
        if (!library) return false

        const { validateLibraryPath } = await import('@/lib/libraryValidator')
        const result = await validateLibraryPath(library.path)

        if (result.isValid) {
          get().markLibraryValid(id)
          return true
        } else {
          get().markLibraryInvalid(id, result.reason ?? '无法访问')
          return false
        }
      },
    }),
    {
      name: 'eriri-library-storage',
    },
  ),
)
