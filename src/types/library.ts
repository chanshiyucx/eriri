export const LibraryType = {
  book: 'book',
  comic: 'comic',
} as const

export type LibraryType = (typeof LibraryType)[keyof typeof LibraryType]

export interface Library {
  id: string
  name: string
  path: string
  type: LibraryType
  createdAt: number
  sortOrder: number
}

/** Per-library navigation memory (device-local; lives in the UI store). */
export interface LibraryNavStatus {
  comicId?: string
  authorId?: string
  bookId?: string
}

export interface Comic {
  id: string
  title: string
  path: string
  cover: string
  libraryId: string
  starred: boolean
  deleted: boolean
  pageCount?: number
  createdAt: number
}

export interface Author {
  id: string
  name: string
  path: string
  libraryId: string
  bookCount: number
  books?: Book[]
}

export interface Book {
  id: string
  title: string
  path: string
  authorId: string
  libraryId: string
  starred: boolean
  deleted: boolean
  size: number
  createdAt: number
}

export interface Chapter {
  title: string
  lineIndex: number
}

export interface BookContent {
  lines: string[]
  chapters: Chapter[]
}

export interface Image {
  path: string
  url: string
  thumbnail: string
  filename: string
  starred: boolean
  deleted: boolean
  width: number
  height: number
  index: number
}

export type ComicImageStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'failed'

export interface ComicImage {
  comicId: string
  status: ComicImageStatus
  images: Image[]
  timestamp: number
  error?: string
}

export interface FileTags {
  starred?: boolean
  deleted?: boolean
}

export interface ComicProgress {
  current: number
  total: number
  percent: number
  lastRead: number
}

export interface BookProgress {
  current: number
  total: number
  percent: number
  lastRead: number
  currentChapterTitle?: string
}
