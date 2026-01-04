import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createDebouncedIDBStorage } from '@/lib/storage'

export interface ComicProgress {
  current: number
  total: number
  percent: number
  lastRead: number
}

export interface BookProgress {
  startCharIndex: number
  totalChars: number
  percent: number
  lastRead: number
  currentChapterTitle?: string
}

interface ProgressState {
  comics: Record<string, ComicProgress>
  books: Record<string, BookProgress>

  updateComicProgress: (comicId: string, progress: ComicProgress) => void
  updateBookProgress: (bookId: string, progress: BookProgress) => void
  removeComicProgress: (comicId: string) => void
  removeBookProgress: (bookId: string) => void
}

export const useProgressStore = create<ProgressState>()(
  persist(
    immer((set) => ({
      comics: {},
      books: {},

      updateComicProgress: (comicId, progress) =>
        set((state) => {
          state.comics[comicId] = progress
        }),

      updateBookProgress: (bookId, progress) =>
        set((state) => {
          state.books[bookId] = progress
        }),

      removeComicProgress: (comicId) =>
        set((state) => {
          delete state.comics[comicId]
        }),

      removeBookProgress: (bookId) =>
        set((state) => {
          delete state.books[bookId]
        }),
    })),
    {
      name: 'eriri-progress-storage',
      storage: createJSONStorage(() => createDebouncedIDBStorage(2000)),
    },
  ),
)
