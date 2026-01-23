export const LibraryType = {
  book: 'book',
  comic: 'comic',
  video: 'video',
} as const

export type LibraryType = (typeof LibraryType)[keyof typeof LibraryType]

export interface Library {
  id: string
  name: string
  path: string
  type: LibraryType
  createdAt: number
  sortOrder: number
  bookmark?: string
  status: {
    comicId?: string
    authorId?: string
    bookId?: string
    videoId?: string
  }
}

export interface Video {
  id: string
  title: string
  path: string
  url: string
  cover: string
  libraryId: string
  createdAt: number
  size: number
  width: number
  height: number
  duration: number
  starred: boolean
  deleted: boolean
}

export interface Comic {
  id: string
  title: string
  path: string
  cover?: string
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

export interface ImageCache {
  count: number
  size: number
}

export interface ComicImage {
  comicId: string
  images: Image[]
  timestamp: number
}

export interface ScannedLibrary {
  comics?: Comic[]
  authors?: Author[]
  videos?: Video[]
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
  currentLineIndex: number
  totalLines: number
  percent: number
  lastRead: number
  currentChapterTitle?: string
}
