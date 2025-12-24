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
  lastValidated?: number
  comics?: Comic[]
  authors?: Author[]
  status?: {
    comicId?: string
    authorId?: string
    bookId?: string
  }
}

export interface Comic {
  id: string
  title: string
  path: string
  cover?: string
  libraryId: string
  pageCount?: number
  createdAt: number
  progress?: {
    current: number
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
  books?: Book[]
}

export interface Book {
  id: string
  title: string
  path: string
  authorId: string
  libraryId: string
  size: number
  createdAt: number
  progress?: {
    startCharIndex: number
    totalChars: number
    percent: number
    lastRead: number
  }
}

export interface Image {
  url: string
  filename: string
}
