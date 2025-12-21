import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Comic, Library } from '@/types/library'

interface LibraryState {
  libraries: Library[]
  comics: Comic[]
  isScanning: boolean
  selectedLibraryId: string | null // null = show all

  addLibrary: (lib: Library) => void
  removeLibrary: (id: string) => void

  setComics: (comics: Comic[]) => void
  addComics: (comics: Comic[]) => void

  setScanning: (isScanning: boolean) => void
  setSelectedLibrary: (id: string | null) => void

  // Helpers to get comics for a library
  getComicsByLibrary: (libraryId: string) => Comic[]
  replaceComicsForLibrary: (libraryId: string, comics: Comic[]) => void
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      libraries: [],
      comics: [],
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

      setScanning: (isScanning) => set({ isScanning }),

      setSelectedLibrary: (id) => set({ selectedLibraryId: id }),

      getComicsByLibrary: (libraryId) =>
        get().comics.filter((c) => c.libraryId === libraryId),

      replaceComicsForLibrary: (libraryId, newComics) =>
        set((state) => ({
          comics: [
            ...state.comics.filter((c) => c.libraryId !== libraryId),
            ...newComics,
          ],
        })),
    }),
    {
      name: 'eriri-library-storage',
    },
  ),
)
