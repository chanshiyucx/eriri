import { Book, ChevronRight, FileText, Folder } from 'lucide-react'
import { useMemo } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/store/library'
import { Book as BookType } from '@/types/library'
import { BookReader } from '../reader/BookReader'

interface BookLibraryViewProps {
  libraryId: string
  onBookClick: (book: BookType) => void
  selectedBook: BookType | null
  onBookSelect: (book: BookType | null) => void
  searchQuery?: string
  sortKey?: 'name' | 'date'
  sortOrder?: 'asc' | 'desc'
}

export function BookLibraryView({
  libraryId,
  selectedBook,
  onBookSelect,
  searchQuery = '',
  sortKey = 'name',
  sortOrder = 'asc',
}: BookLibraryViewProps) {
  const {
    getAuthorsByLibrary,
    getBooksByAuthor,
    updateBookProgress,
    libraryStates,
    setLibraryState,
  } = useLibraryStore()

  // Subscribe to all books to trigger re-renders on progress updates
  // We don't use the value directly, just subscribe to ensure reactivity
  const booksVersion = useLibraryStore((state) =>
    state.books.map((b) => `${b.id}:${b.progress?.percent ?? 0}`).join(','),
  )

  const authors = useMemo(() => {
    const result = getAuthorsByLibrary(libraryId)
    // If sorting logic for authors is needed, add here.
    // For now, authors are simple lists.
    return result
  }, [libraryId, getAuthorsByLibrary])

  // Get persisted state for this library
  const libraryState = libraryStates[libraryId] || {
    selectedAuthorId: null,
    selectedBookId: null,
  }
  const { selectedAuthorId } = libraryState

  const selectedAuthor = useMemo(
    () => authors.find((a) => a.id === selectedAuthorId) ?? null,
    [authors, selectedAuthorId],
  )

  // Filter and Sort Books
  const books = useMemo(() => {
    // 1. Get relevant books
    // If we have a selected author, get their books.
    // If searching, we might want to search across ALL books?
    // User expectation: "Search for books".
    // If I search "Harry", should I see results even if I'm in "JK Rowling"?
    // Or should searching disable author selection?
    // Let's assume standard behavior: Search filters THE CURRENT VIEW if author selected,
    // OR search searches EVERYTHING if no author selected?
    // Usually library search is global.
    // Let's make search global. If searchQuery is present, we show ALL books matching.
    // But that breaks the 3-column flow (Author list becomes irrelevant?).
    // Let's stick to: Select Author -> Filter Books. Search filters those books.
    // User said "Search and sort are for books".

    // BUT: What if I don't know the author?
    // Let's stick to the scoped approach for now to avoid UI complexity (hiding col 1).
    // Or, if searchQuery is present, maybe we highlight Authors that contain matches?
    // Let's just filter the current list.

    if (!selectedAuthor) return []

    let result = getBooksByAuthor(selectedAuthor.id)

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((b) => b.title.toLowerCase().includes(q))
    }

    // Sort
    return result.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        cmp = a.title.localeCompare(b.title, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      } else {
        cmp = (a.createdAt || 0) - (b.createdAt || 0)
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedAuthor,
    getBooksByAuthor,
    searchQuery,
    sortKey,
    sortOrder,
    booksVersion,
  ])

  // If selectedBook changes (e.g. from outside or initial), we should ensure author is selected?
  // Not strictly necessary if we rely on user clicking author.

  return (
    <div className="flex h-full w-full divide-x">
      {/* Column 1: Authors - Fixed 300px */}
      <div className="flex w-[300px] shrink-0 flex-col">
        <div className="bg-base text-subtle px-4 py-2 text-xs font-medium uppercase">
          Authors ({authors.length})
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 p-2">
            {authors.map((author) => (
              <button
                key={author.id}
                onClick={() => {
                  setLibraryState(libraryId, {
                    selectedAuthorId: author.id,
                    selectedBookId: null,
                  })
                  onBookSelect(null)
                }}
                className={cn(
                  'hover:bg-base flex items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors',
                  selectedAuthorId === author.id && 'bg-base',
                )}
              >
                <Folder className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{author.name}</span>
                <span className="text-muted-foreground text-xs">
                  {author.bookCount}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Column 2: Books - Fixed 300px */}
      <div className="bg-surface flex w-[300px] shrink-0 flex-col">
        <div className="bg-base text-subtle px-4 py-2 text-xs font-medium uppercase">
          Books ({books.length})
        </div>
        <ScrollArea className="flex-1">
          {selectedAuthor && (
            <div className="flex flex-col gap-1 p-2">
              {books.map((book) => (
                <button
                  key={book.id}
                  onClick={() => onBookSelect(book)}
                  className={cn(
                    'hover:bg-base flex items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors',
                    selectedBook?.id === book.id && 'bg-base',
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
                </button>
              ))}
              {books.length === 0 && (
                <div className="text-muted-foreground p-4 text-center text-sm">
                  {searchQuery ? 'No matching books' : 'No books found'}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Column 3: Preview (Reading) */}
      <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
        {!selectedBook ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center">
            <FileText className="mb-2 h-12 w-12 opacity-20" />
            <p className="text-sm">Select a book to preview</p>
          </div>
        ) : (
          <BookReader
            key={selectedBook.id} // Re-mount on change
            bookPath={selectedBook.path}
            initialProgress={selectedBook.progress}
            onExit={() => undefined} // No exit in preview
            onProgressUpdate={(p) => updateBookProgress(selectedBook.id, p)}
            mode="preview"
          />
        )}
      </div>
    </div>
  )
}
