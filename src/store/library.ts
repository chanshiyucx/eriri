import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import {
  generateUuid,
  getLibraryType,
  scanBookLibrary,
  scanComicImages,
  scanComicLibrary,
  scanVideoLibrary,
} from '@/lib/scanner'
import { createIDBStorage } from '@/lib/storage'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
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
  type Video,
} from '@/types/library'

const MAX_CACHE_SIZE = 30

interface LibraryState {
  isScanning: boolean

  libraries: Record<string, Library>
  comics: Record<string, Comic>
  authors: Record<string, Author>
  books: Record<string, Book>
  videos: Record<string, Video>

  libraryComics: Record<string, string[]>
  libraryAuthors: Record<string, string[]>
  libraryVideos: Record<string, string[]>
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

  getComicImages: (comicId: string) => Promise<Image[]>
  addComicImages: (comicId: string, images: Image[]) => void
  removeComicImages: (comicId: string) => void

  updateBookTags: (bookId: string, tags: FileTags) => void
  updateComicTags: (comicId: string, tags: FileTags) => void
  updateVideoTags: (videoId: string, tags: FileTags) => void
  updateComicImageTags: (
    comicId: string,
    filename: string,
    tags: FileTags,
  ) => void
}

/**
 * Apply scanned library data to state (DRY helper)
 * Note: state type is inferred from immer's Draft<LibraryState>
 */
function applyScannedLibrary(
  state: LibraryState,
  libraryId: string,
  scannedLibrary: ScannedLibrary,
) {
  const { comics = [], authors = [], videos = [] } = scannedLibrary

  // Apply comics
  state.libraryComics[libraryId] = comics.map((c) => {
    state.comics[c.id] = c
    return c.id
  })

  // Apply videos
  state.libraryVideos[libraryId] = videos.map((v) => {
    state.videos[v.id] = v
    return v.id
  })

  // Apply authors and their books
  state.libraryAuthors[libraryId] = authors.map((a) => {
    const { books = [], ...authorInfo } = a
    state.authors[a.id] = authorInfo
    state.authorBooks[a.id] = books.map((b) => {
      state.books[b.id] = b
      return b.id
    })
    return a.id
  })
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    immer((set, get) => ({
      libraries: {},
      comics: {},
      authors: {},
      books: {},
      videos: {},
      libraryComics: {},
      libraryAuthors: {},
      libraryVideos: {},
      authorBooks: {},
      comicImages: {},
      selectedLibraryId: null,
      isScanning: false,

      addLibrary: (library, scannedLibrary) =>
        set((state) => {
          state.libraries[library.id] = library
          applyScannedLibrary(state, library.id, scannedLibrary)
        }),

      updateLibrary: (id, data, scannedLibrary) =>
        set((state) => {
          const library = state.libraries[id]
          if (!library) return
          Object.assign(library, data)

          if (scannedLibrary) {
            applyScannedLibrary(state, id, scannedLibrary)
          }
        }),

      removeLibrary: (id) =>
        set((state) => {
          const comicIds = state.libraryComics[id] ?? []
          const authorIds = state.libraryAuthors[id] ?? []
          const videoIds = state.libraryVideos[id] ?? []
          const bookIds = authorIds.flatMap(
            (aId) => state.authorBooks[aId] ?? [],
          )

          const idsToRemove = new Set([...comicIds, ...bookIds])

          const progressStore = useProgressStore.getState()
          const tabsStore = useTabsStore.getState()

          const tabsToRemove = tabsStore.tabs.filter((t) =>
            idsToRemove.has(t.id),
          )

          for (const cId of comicIds) {
            delete state.comics[cId]
            delete state.comicImages[cId]
            progressStore.removeComicProgress(cId)
          }

          for (const aId of authorIds) {
            delete state.authors[aId]
            delete state.authorBooks[aId]
          }

          for (const bId of bookIds) {
            delete state.books[bId]
            progressStore.removeBookProgress(bId)
          }

          for (const vId of videoIds) {
            delete state.videos[vId]
          }

          delete state.libraryComics[id]
          delete state.libraryAuthors[id]
          delete state.libraryVideos[id]
          delete state.libraries[id]

          tabsToRemove.forEach((t) => tabsStore.removeTab(t.path))

          if (state.selectedLibraryId === id) {
            state.selectedLibraryId = null
          }
        }),

      importLibrary: async (path) => {
        set({ isScanning: true })
        try {
          const libraryId = await generateUuid(path)
          const existingLibrary = get().libraries[libraryId]
          if (existingLibrary) return

          const type = await getLibraryType(path)
          console.log('getLibraryType:', type, path)
          const libraryName = path.split('/').pop() ?? 'Untitled Library'
          const library: Library = {
            id: libraryId,
            name: libraryName,
            path,
            type,
            createdAt: Date.now(),
            status: {
              comicId: '',
              authorId: '',
              bookId: '',
              videoId: '',
            },
          }

          const scannedLibrary: ScannedLibrary = {}
          if (type === LibraryType.book) {
            scannedLibrary.authors = await scanBookLibrary(path, libraryId)
          } else if (type === LibraryType.video) {
            scannedLibrary.videos = await scanVideoLibrary(path, libraryId)
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
          } else if (lib.type === LibraryType.video) {
            scannedLibrary.videos = await scanVideoLibrary(lib.path, lib.id)
          } else {
            scannedLibrary.comics = await scanComicLibrary(lib.path, lib.id)
            const comicIds = scannedLibrary.comics?.map((c) => c.id) ?? []
            set((state) => {
              for (const comicId of comicIds) {
                delete state.comicImages[comicId]
              }
            })
          }
          get().updateLibrary(id, {}, scannedLibrary)
        } finally {
          set({ isScanning: false })
        }
      },

      setSelectedLibraryId: (id) => set({ selectedLibraryId: id }),

      updateBookTags: (bookId, tags) =>
        set((state) => {
          const book = state.books[bookId]
          if (book) {
            if (tags.starred !== undefined) book.starred = tags.starred
            if (tags.deleted !== undefined) book.deleted = tags.deleted
          }
        }),

      updateComicTags: (comicId, tags) =>
        set((state) => {
          const comic = state.comics[comicId]
          if (comic) {
            if (tags.starred !== undefined) comic.starred = tags.starred
            if (tags.deleted !== undefined) comic.deleted = tags.deleted
          }
        }),

      updateVideoTags: (videoId, tags) =>
        set((state) => {
          const video = state.videos[videoId]
          if (video) {
            if (tags.starred !== undefined) video.starred = tags.starred
            if (tags.deleted !== undefined) video.deleted = tags.deleted
          }
        }),

      updateComicImageTags: (comicId, filename, tags) =>
        set((state) => {
          const comicImages = state.comicImages[comicId]
          if (!comicImages) return

          const image = comicImages.images.find((i) => i.filename === filename)
          if (image) {
            if (tags.starred !== undefined) image.starred = tags.starred
            if (tags.deleted !== undefined) image.deleted = tags.deleted
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

            const entries = Object.values(state.comicImages)
            if (entries.length <= MAX_CACHE_SIZE) return

            entries
              .sort((a, b) => a.timestamp - b.timestamp)
              .slice(0, entries.length - MAX_CACHE_SIZE + 5)
              .forEach((item) => delete state.comicImages[item.comicId])

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
          state.comicImages[comicId] = {
            comicId,
            images,
            timestamp: Date.now(),
          }
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
