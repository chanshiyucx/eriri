export type LibraryType = 'comic' | 'book'

export interface ComicImage {
  url: string
  filename: string
}

export interface Library {
  id: string
  name: string
  path: string
  type: LibraryType
  createdAt: number
  // For external drive matching
  volumeLabel?: string
  uuid?: string
}

export interface Comic {
  id: string
  title: string
  path: string
  cover?: string
  libraryId: string
  pageCount?: number
  createdAt: number
  // Reading progress
  progress?: {
    current: number // page index
    total: number
    percent: number
    lastRead: number
  }
}

export interface Author {
  id: string
  name: string
  path: string
  libraryId: string
  bookCount: number
}

export interface Book {
  id: string
  title: string
  path: string
  authorId: string
  libraryId: string
  size: number
  createdAt: number
  // Reading progress
  progress?: {
    currentChart: number // character count or line
    totalChars: number
    percent: number
    lastRead: number
  }
}
