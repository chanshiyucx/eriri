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
  // Reading progress
  progress?: {
    current: number // page index
    total: number
    percent: number
    lastRead: number
  }
}
