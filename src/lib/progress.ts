import type { BookProgress, Chapter, ComicProgress } from '@/types/library'

export function createComicProgress(
  current: number,
  total: number,
): ComicProgress {
  return {
    current,
    total,
    percent: total > 1 ? (current / (total - 1)) * 100 : 100,
    lastRead: Date.now(),
  }
}

export function createBookProgress(
  current: number,
  total: number,
  chapters: Chapter[],
): BookProgress {
  const match = chapters.findLast((c) => c.lineIndex <= current)
  return {
    current,
    total,
    percent: total > 1 ? (current / (total - 1)) * 100 : 100,
    currentChapterTitle: match?.title ?? '',
    lastRead: Date.now(),
  }
}
