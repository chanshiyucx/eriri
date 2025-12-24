import { Book, ChevronRight, Folder } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/store/library'
// import { useUIStore } from '@/store/ui'
import { BookReader } from './BookReader'

export function BookLibrary() {
  const { libraries, selectedLibraryId, updateLibrary } = useLibraryStore()

  // const { searchQuery, sortKey, sortOrder } = useUIStore()

  const selectedLibrary = useMemo(
    () => libraries.find((l) => l.id === selectedLibraryId),
    [libraries, selectedLibraryId],
  )

  if (!selectedLibrary) return null

  const { id, authors = [], status = {} } = selectedLibrary

  // const { authorId, bookId } = status

  const selectedAuthor = authors.find((a) => a.id === status.authorId)
  const books = selectedAuthor?.books ?? []

  //   const authors = selectedLibrary.authors ?? []

  const handleSelectAuthor = (authorId: string) => {
    console.log('handleSelectAuthor---', authorId)
    updateLibrary(id, { status: { authorId } })
  }

  const handleSelectBook = (bookId: string) => {
    updateLibrary(id, { status: { authorId: status.authorId, bookId } })
  }

  console.log('status---', { ...status }, selectedAuthor)

  //   const authors = useMemo(() => {
  //     const result = getAuthorsByLibrary(libraryId)
  //     // If sorting logic for authors is needed, add here.
  //     // For now, authors are simple lists.
  //     return result
  //   }, [libraryId, getAuthorsByLibrary])

  // Get persisted state for this library
  //   const libraryState = libraryStates[libraryId] || {
  //     selectedAuthorId: null,
  //     selectedBookId: null,
  //   }
  //   const { selectedAuthorId } = libraryState

  //   const selectedAuthor = useMemo(
  //     () => authors.find((a) => a.id === selectedAuthorId) ?? null,
  //     [authors, selectedAuthorId],
  //   )

  // Filter and Sort Books
  //   const books = useMemo(() => {
  //     if (!selectedAuthor) return []

  //     let result = getBooksByAuthor(selectedAuthor.id)

  //     if (searchQuery.trim()) {
  //       const q = searchQuery.toLowerCase().trim()
  //       result = result.filter((b) => b.title.toLowerCase().includes(q))
  //     }

  //     // Sort
  //     return result.sort((a, b) => {
  //       let cmp = 0
  //       if (sortKey === 'name') {
  //         cmp = a.title.localeCompare(b.title, undefined, {
  //           numeric: true,
  //           sensitivity: 'base',
  //         })
  //       } else {
  //         cmp = (a.createdAt || 0) - (b.createdAt || 0)
  //       }
  //       return sortOrder === 'asc' ? cmp : -cmp
  //     })
  //   }, [selectedAuthor, getBooksByAuthor, searchQuery, sortKey, sortOrder])

  return (
    <div className="flex h-full w-full divide-x">
      {/* Column 1: Authors */}
      <div className="flex w-[300px] shrink-0 flex-col">
        <div className="bg-base text-subtle border-b px-4 py-2 text-xs uppercase">
          Authors ({authors.length})
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {authors.map((author) => (
              <Button
                key={author.id}
                onClick={() => handleSelectAuthor(author.id)}
                className={cn(
                  'hover:bg-overlay flex items-center gap-2 rounded-none px-3 py-2 text-left text-sm transition-colors',
                  status.authorId === author.id ? 'bg-overlay' : 'bg-surface',
                )}
              >
                <Folder className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{author.name}</span>
                <span className="text-subtle text-xs">
                  {author.books?.length}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Column 2: Books */}
      <div className="flex w-[300px] shrink-0 flex-col">
        <div className="bg-base text-subtle border-b px-4 py-2 text-xs uppercase">
          Books ({books.length})
        </div>
        <ScrollArea className="flex-1">
          {selectedAuthor && (
            <div className="flex flex-col">
              {books.map((book) => (
                <Button
                  key={book.id}
                  onClick={() => handleSelectBook(book.id)}
                  className={cn(
                    'hover:bg-overlay flex items-center gap-2 rounded-none px-3 py-2 text-left text-sm transition-colors',
                    status.bookId === book.id ? 'bg-overlay' : 'bg-surface',
                  )}
                >
                  <Book className="h-4 w-4 shrink-0" />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate font-medium">{book.title}</span>
                    <span className="text-subtle flex shrink-0 items-center gap-1 text-xs whitespace-nowrap opacity-70">
                      {book.progress && book.progress.percent > 0 && (
                        <>
                          <span>{Math.round(book.progress.percent)}%</span>
                          <span>•</span>
                        </>
                      )}
                      <span>{(book.size / 1024).toFixed(1)}k</span>{' '}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Column 3: Preview */}
      {status.bookId && status.authorId && selectedAuthor && (
        <BookReader
          libraryId={id}
          authorId={status.authorId}
          bookId={status.bookId}
        />
      )}
    </div>
  )
}
