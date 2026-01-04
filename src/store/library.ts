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
import { useTabsStore, type Tab } from '@/store/tabs'
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

  isScanning: boolean

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
          const { comics = [], authors = [], videos = [] } = scannedLibrary
          state.libraries[library.id] = library

          const comicIds: string[] = []
          comics.forEach((c) => {
            state.comics[c.id] = c
            comicIds.push(c.id)
          })
          state.libraryComics[library.id] = comicIds

          const videoIds: string[] = []
          videos.forEach((v) => {
            state.videos[v.id] = v
            videoIds.push(v.id)
          })
          state.libraryVideos[library.id] = videoIds

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

          const { comics = [], authors = [], videos = [] } = scannedLibrary
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

          const videoIds: string[] = []
          videos.forEach((v) => {
            state.videos[v.id] = v
            videoIds.push(v.id)
          })
          state.libraryVideos[library.id] = videoIds
        }),

      removeLibrary: (id) =>
        set((state) => {
          const comicIds = state.libraryComics[id] ?? []
          const authorIds = state.libraryAuthors[id] ?? []
          const videoIds = state.libraryVideos[id] ?? []
          const bookIds = authorIds.flatMap(
            (aId) => state.authorBooks[aId] ?? [],
          )

          const tabsStore = useTabsStore.getState()
          let tabsToRemove: Tab[] = []

          comicIds.forEach((cId) => {
            delete state.comics[cId]
            delete state.comicImages[cId]
            tabsToRemove = tabsStore.tabs.filter((t) => t.id === cId)
          })

          authorIds.forEach((aId) => {
            delete state.authors[aId]
            delete state.authorBooks[aId]
          })

          videoIds.forEach((vId) => {
            delete state.videos[vId]
          })

          bookIds.forEach((bId) => {
            delete state.books[bId]
            tabsToRemove = tabsStore.tabs.filter((t) => t.id === bId)
          })

          delete state.libraryComics[id]
          delete state.libraryAuthors[id]
          delete state.libraryVideos[id]
          delete state.libraries[id]
          tabsToRemove.forEach((t) => tabsStore.removeTab(t.path))

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
              comicIds.forEach((comicId) => {
                delete state.comicImages[comicId]
              })
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

      updateVideoTags: (videoId, tags) =>
        set((state) => {
          const video = state.videos[videoId]
          if (video) {
            Object.assign(video, tags)
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
