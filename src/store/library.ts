import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import * as api from '@/lib/library-api'
import { scanComicImages, setFileTag } from '@/lib/scanner'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import {
  type Author,
  type Book,
  type Comic,
  type ComicImage,
  type ComicImageStatus,
  type FileTags,
  type Image,
  type Library,
} from '@/types/library'

const MAX_CACHE_SIZE = 30
const comicImageLoads = new Map<string, Promise<Image[]>>()
let activeComicImageLoads = 0

// Natural ordering (so "10" sorts after "2"), matching the backend scan order.
const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

interface LibraryState {
  libraries: Record<string, Library>
  comics: Record<string, Comic>
  authors: Record<string, Author>
  books: Record<string, Book>
  libraryComics: Record<string, string[]>
  libraryAuthors: Record<string, string[]>
  authorBooks: Record<string, string[]>
  comicImages: Record<string, ComicImage>
  hydrate: () => Promise<void>
  refreshLibrary: (libraryId: string) => Promise<void>
  removeLibrary: (id: string) => Promise<void>
  reorderLibrary: (orderedIds: string[]) => void
  getComicImages: (comicId: string) => Promise<Image[]>
  updateBookTags: (bookId: string, tags: FileTags) => Promise<void>
  updateComicTags: (comicId: string, tags: FileTags) => Promise<void>
  updateComicImageTags: (
    comicId: string,
    filename: string,
    tags: FileTags,
  ) => Promise<void>
}

function terminalComicImageStatus(images: Image[]): ComicImageStatus {
  return images.length ? 'ready' : 'empty'
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function beginComicImageScan() {
  activeComicImageLoads += 1
  useUIStore.getState().setIsScanning(true)
}

function endComicImageScan() {
  activeComicImageLoads = Math.max(0, activeComicImageLoads - 1)
  if (activeComicImageLoads === 0) useUIStore.getState().setIsScanning(false)
}

interface CatalogMaps {
  libraries: Record<string, Library>
  comics: Record<string, Comic>
  authors: Record<string, Author>
  books: Record<string, Book>
  libraryComics: Record<string, string[]>
  libraryAuthors: Record<string, string[]>
  authorBooks: Record<string, string[]>
}

function buildMaps(catalog: api.Catalog): CatalogMaps {
  const libraries: Record<string, Library> = {}
  for (const lib of catalog.libraries) libraries[lib.id] = lib

  const comics: Record<string, Comic> = {}
  const libraryComics: Record<string, string[]> = {}
  for (const c of catalog.comics) {
    comics[c.id] = c
    ;(libraryComics[c.libraryId] ??= []).push(c.id)
  }

  const authors: Record<string, Author> = {}
  const libraryAuthors: Record<string, string[]> = {}
  for (const a of catalog.authors) {
    authors[a.id] = a
    ;(libraryAuthors[a.libraryId] ??= []).push(a.id)
  }

  const books: Record<string, Book> = {}
  const authorBooks: Record<string, string[]> = {}
  for (const b of catalog.books) {
    books[b.id] = b
    ;(authorBooks[b.authorId] ??= []).push(b.id)
  }

  for (const ids of Object.values(libraryComics))
    ids.sort((x, y) => collator.compare(comics[x].title, comics[y].title))
  for (const ids of Object.values(libraryAuthors))
    ids.sort((x, y) => collator.compare(authors[x].name, authors[y].name))
  for (const ids of Object.values(authorBooks))
    ids.sort((x, y) => collator.compare(books[x].title, books[y].title))

  return {
    libraries,
    comics,
    authors,
    books,
    libraryComics,
    libraryAuthors,
    authorBooks,
  }
}

export const useLibraryStore = create<LibraryState>()(
  immer((set, get) => ({
    libraries: {},
    comics: {},
    authors: {},
    books: {},
    libraryComics: {},
    libraryAuthors: {},
    authorBooks: {},
    comicImages: {},

    hydrate: async () => {
      try {
        const catalog = await api.fetchCatalog()
        const maps = buildMaps(catalog)
        set((state) => {
          Object.assign(state, maps)
        })
      } catch (error) {
        console.error('Failed to fetch catalog:', error)
      }
    },

    refreshLibrary: async (id) => {
      const setScanning = useUIStore.getState().setIsScanning
      setScanning(true)
      try {
        const comicIds = get().libraryComics[id] ?? []
        await api.refreshLibrary(id)
        set((state) => {
          for (const comicId of comicIds) {
            comicImageLoads.delete(comicId)
            delete state.comicImages[comicId]
          }
        })
        await get().hydrate()
      } finally {
        setScanning(false)
      }
    },

    removeLibrary: async (id) => {
      const state = get()
      const comicIds = state.libraryComics[id] ?? []
      const authorIds = state.libraryAuthors[id] ?? []
      const bookIds = authorIds.flatMap((aId) => state.authorBooks[aId] ?? [])

      await api.removeLibrary(id)

      const progressStore = useProgressStore.getState()
      const tabsStore = useTabsStore.getState()
      const uiStore = useUIStore.getState()

      const idsToRemove = new Set([...comicIds, ...bookIds])
      tabsStore.tabs
        .filter((t) => idsToRemove.has(t.id))
        .forEach((t) => {
          tabsStore.removeTab(t.id)
        })

      for (const cId of comicIds) progressStore.removeComicProgress(cId)
      for (const bId of bookIds) {
        progressStore.removeBookProgress(bId)
        progressStore.removeBookChapters(bId)
      }

      uiStore.clearNavStatus(id)
      if (uiStore.selectedLibraryId === id) uiStore.setSelectedLibraryId(null)

      await get().hydrate()
    },

    reorderLibrary: (orderedIds) => {
      set((state) => {
        orderedIds.forEach((id, index) => {
          const lib = state.libraries[id]
          if (lib) lib.sortOrder = index
        })
      })
      void api.reorderLibraries(orderedIds)
    },

    updateBookTags: async (bookId, tags) => {
      const book = get().books[bookId]
      if (!book) return

      const isSuccess = await api.setBookTags(bookId, tags)
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

      const isSuccess = await api.setComicTags(comicId, tags)
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

      if (cache && cache.status !== 'failed' && cache.status !== 'loading') {
        set((state) => {
          const item = state.comicImages[comicId]
          item.timestamp = Date.now()
        })
        return cache.images
      }
      if (cache?.status === 'loading') {
        const loading = comicImageLoads.get(comicId)
        if (loading) return loading
      }
      const existingLoad = comicImageLoads.get(comicId)
      if (existingLoad) return existingLoad

      const comic = get().comics[comicId]
      if (!comic) return []

      set((state) => {
        state.comicImages[comicId] = {
          comicId,
          status: 'loading',
          images: [],
          timestamp: Date.now(),
        }
      })

      const load = (async () => {
        beginComicImageScan()
        try {
          const images = await scanComicImages(comic.path)
          set((state) => {
            state.comicImages[comicId] = {
              comicId,
              status: terminalComicImageStatus(images),
              images,
              timestamp: Date.now(),
            }
            const c = state.comics[comicId]
            if (c) c.pageCount = images.length

            const entries = Object.values(state.comicImages).filter(
              (item) => item.status !== 'loading',
            )
            if (entries.length > MAX_CACHE_SIZE) {
              entries
                .sort((a, b) => a.timestamp - b.timestamp)
                .slice(0, entries.length - MAX_CACHE_SIZE + 5)
                .forEach((item) => delete state.comicImages[item.comicId])
            }
          })
          return images
        } catch (error) {
          const message = describeError(error)
          console.error('Failed to scan comic images:', error)
          set((state) => {
            state.comicImages[comicId] = {
              comicId,
              status: 'failed',
              images: [],
              timestamp: Date.now(),
              error: message,
            }
          })
          return []
        } finally {
          comicImageLoads.delete(comicId)
          endComicImageScan()
        }
      })()

      comicImageLoads.set(comicId, load)
      return load
    },
  })),
)
