import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import * as api from '@/lib/progress-api'
import type { BookProgress, ComicProgress } from '@/types/library'

interface ProgressState {
  comics: Record<string, ComicProgress>
  books: Record<string, BookProgress>
  favoriteChapters: Record<string, number[]>
  hydrate: () => Promise<void>
  updateComicProgress: (comicId: string, progress: ComicProgress) => void
  updateBookProgress: (bookId: string, progress: BookProgress) => void
  removeComicProgress: (comicId: string) => void
  removeBookProgress: (bookId: string) => void
  toggleChapterFavorite: (bookId: string, lineIndex: number) => void
  removeBookChapters: (bookId: string) => void
}

export const useProgressStore = create<ProgressState>()(
  immer((set) => ({
    comics: {},
    books: {},
    favoriteChapters: {},

    hydrate: async () => {
      try {
        const snapshot = await api.fetchProgress()
        set((state) => {
          state.comics = snapshot.comics
          state.books = snapshot.books
          state.favoriteChapters = snapshot.favoriteChapters
        })
      } catch (error) {
        console.error('Failed to fetch progress:', error)
      }
    },

    updateComicProgress: (comicId, progress) => {
      set((state) => {
        state.comics[comicId] = progress
      })
      void api.saveComicProgress(comicId, progress)
    },

    updateBookProgress: (bookId, progress) => {
      set((state) => {
        state.books[bookId] = progress
      })
      void api.saveBookProgress(bookId, progress)
    },

    removeComicProgress: (comicId) => {
      set((state) => {
        delete state.comics[comicId]
      })
      void api.removeComicProgress(comicId)
    },

    removeBookProgress: (bookId) => {
      set((state) => {
        delete state.books[bookId]
      })
      void api.removeBookProgress(bookId)
    },

    toggleChapterFavorite: (bookId, lineIndex) => {
      let next: number[] = []
      set((state) => {
        const list = state.favoriteChapters[bookId]
        if (!list) {
          state.favoriteChapters[bookId] = [lineIndex]
        } else {
          const idx = list.indexOf(lineIndex)
          if (idx === -1) {
            list.push(lineIndex)
          } else {
            list.splice(idx, 1)
            if (list.length === 0) delete state.favoriteChapters[bookId]
          }
        }
        next = state.favoriteChapters[bookId]
          ? [...state.favoriteChapters[bookId]]
          : []
      })
      void api.saveBookFavorites(bookId, next)
    },

    removeBookChapters: (bookId) => {
      set((state) => {
        delete state.favoriteChapters[bookId]
      })
      void api.removeBookFavorites(bookId)
    },
  })),
)
