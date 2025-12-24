对于漫画库的结构:

- ComicLibrary
  - Commic1
    - Image1
    - Image2
    - Image3
  - Commic2
  - Commic3

对于电子书的结构:

- BookLibrary
  - Author1
    - Book1
    - Book2
    - Book3
  - Author2
  - Author3

## 根据上面的结构，我认为不需要特别区分ComicLibrary和BookLibrary

- Library
  - Folder1
    - File1
    - File2
    - File3
  - Folder2
  - Folder3

优化后结构如下：

```typescript
export interface Library {
  id: string
  name: string
  path: string
  libraryType: 'comic' | 'book'
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
```
