export interface Library {
  id: string
  name: string
  path: string
  type: 'comic' | 'book'
  folders: Folder[]
}

export interface Folder {
  id: string
  name: string
  path: string
  libraryId: string
  createdAt: number
  updatedAt: number
  files: File[]
}

export interface File {
  id: string
  name: string
  path: string
  libraryId: string
  folderId: string
  createdAt: number
  updatedAt: number
}
