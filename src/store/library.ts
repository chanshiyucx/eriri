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
  setFileTag,
} from '@/lib/scanner'
import { createTauriFileStorage } from '@/lib/storage'
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

// Stable storage instance for async persistence
const libraryStorage = createTauriFileStorage('library')

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
  reorderLibrary: (orderedIds: string[]) => void

  selectedLibraryId: string | null
  setSelectedLibraryId: (id: string | null) => void

  getComicImages: (comicId: string) => Promise<Image[]>
  addComicImages: (comicId: string, images: Image[]) => void
  removeComicImages: (comicId: string) => void

  updateBookTags: (bookId: string, tags: FileTags) => Promise<void>
  updateComicTags: (comicId: string, tags: FileTags) => Promise<void>
  updateVideoTags: (videoId: string, tags: FileTags) => Promise<void>
  updateComicImageTags: (
    comicId: string,
    filename: string,
    tags: FileTags,
  ) => Promise<void>
}

/**
 * Apply scanned library data to state (DRY helper)
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
      isScanning: false,
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

          const progressStore = useProgressStore.getState()
          const tabsStore = useTabsStore.getState()

          const idsToRemove = new Set([...comicIds, ...bookIds])
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
        const libraryId = await generateUuid(path)
        const existingLibrary = get().libraries[libraryId]
        if (existingLibrary) return

        const type = await getLibraryType(path)
        const libraryName = path.split('/').pop() ?? 'Untitled Library'
        const maxSortOrder = Math.max(
          0,
          ...Object.values(get().libraries).map((l) => l.sortOrder ?? 0),
        )
        const library: Library = {
          id: libraryId,
          name: libraryName,
          path,
          type,
          createdAt: Date.now(),
          sortOrder: maxSortOrder + 1,
          status: {
            comicId: '',
            authorId: '',
            bookId: '',
            videoId: '',
          },
        }

        set({ isScanning: true })
        const scannedLibrary: ScannedLibrary = {}
        if (type === LibraryType.book) {
          scannedLibrary.authors = await scanBookLibrary(path, libraryId)
        } else if (type === LibraryType.video) {
          scannedLibrary.videos = await scanVideoLibrary(path, libraryId)
        } else {
          scannedLibrary.comics = await scanComicLibrary(path, libraryId)
        }
        get().addLibrary(library, scannedLibrary)
        set({ isScanning: false })
      },

      refreshLibrary: async (id) => {
        const lib = get().libraries[id]
        if (!lib) return

        set({ isScanning: true })
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
        set({ isScanning: false })
      },

      setSelectedLibraryId: (id) => set({ selectedLibraryId: id }),

      reorderLibrary: (orderedIds) =>
        set((state) => {
          orderedIds.forEach((id, index) => {
            const lib = state.libraries[id]
            if (lib) lib.sortOrder = index
          })
        }),

      updateBookTags: async (bookId, tags) => {
        const book = get().books[bookId]
        if (!book) return

        const isSuccess = await setFileTag(book.path, tags)
        if (isSuccess) {
          set((state) => {
            const b = state.books[bookId]
            if (b) {
              if (tags.starred !== undefined) b.starred = tags.starred
              if (tags.deleted !== undefined) b.deleted = tags.deleted
            }
          })
        }
      },

      updateComicTags: async (comicId, tags) => {
        const comic = get().comics[comicId]
        if (!comic) return

        const isSuccess = await setFileTag(comic.path, tags)
        if (isSuccess) {
          set((state) => {
            const c = state.comics[comicId]
            if (c) {
              if (tags.starred !== undefined) c.starred = tags.starred
              if (tags.deleted !== undefined) c.deleted = tags.deleted
            }
          })
        }
      },

      updateVideoTags: async (videoId, tags) => {
        const video = get().videos[videoId]
        if (!video) return

        const isSuccess = await setFileTag(video.path, tags)
        if (isSuccess) {
          set((state) => {
            const v = state.videos[videoId]
            if (v) {
              if (tags.starred !== undefined) v.starred = tags.starred
              if (tags.deleted !== undefined) v.deleted = tags.deleted
            }
          })
        }
      },

      updateComicImageTags: async (comicId, filename, tags) => {
        const comicImages = get().comicImages[comicId]
        if (!comicImages) return

        const image = comicImages.images.find((i) => i.filename === filename)
        if (!image) return

        const isSuccess = await setFileTag(image.path, tags)
        if (isSuccess) {
          set((state) => {
            const ci = state.comicImages[comicId]
            if (!ci) return

            const img = ci.images.find((i) => i.filename === filename)
            if (img) {
              if (tags.starred !== undefined) img.starred = tags.starred
              if (tags.deleted !== undefined) img.deleted = tags.deleted
            }
          })
        }
      },

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

        const images = await scanComicImages(comic.path)
        get().addComicImages(comicId, images)

        return images
      },

      addComicImages: (comicId, images) =>
        set((state) => {
          state.comicImages[comicId] = {
            comicId,
            images,
            timestamp: Date.now(),
          }

          const comic = state.comics[comicId]
          if (comic) comic.pageCount = images.length

          const entries = Object.values(state.comicImages)
          if (entries.length <= MAX_CACHE_SIZE) return

          entries
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(0, entries.length - MAX_CACHE_SIZE + 5)
            .forEach((item) => delete state.comicImages[item.comicId])
        }),

      removeComicImages: (comicId) =>
        set((state) => {
          delete state.comicImages[comicId]
        }),
    })),
    {
      name: 'library',
      storage: createJSONStorage(() => libraryStorage),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      partialize: ({ isScanning, comicImages, ...rest }) => rest,
    },
  ),
)
