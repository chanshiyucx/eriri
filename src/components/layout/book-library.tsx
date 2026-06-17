import { Book as BookIcon, Folder, Star, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNativeOpen } from '@/hooks/use-native-open'
import { usePanelNav } from '@/hooks/use-panel-nav'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useUIStore } from '@/store/ui'
import type { Author, Book, Library } from '@/types/library'
import { BookReader } from './book-reader'

interface BookItemProps {
  book: Book
  isSelected: boolean
  onClick: (id: string) => void
}

function BookItem({ book, isSelected, onClick }: BookItemProps) {
  const progress = useProgressStore((s) => s.books[book.id])

  return (
    <Button
      onClick={() => {
        onClick(book.id)
      }}
      className={cn(
        'hover:bg-overlay flex h-8 w-full items-center gap-2 rounded-none px-3 text-sm',
        isSelected ? 'bg-overlay text-love' : 'bg-surface',
        book.deleted && 'text-subtle/40',
      )}
    >
      {book.deleted ? (
        <Trash2 className="h-4 w-4 shrink-0" />
      ) : book.starred ? (
        <Star className="text-love fill-gold/80 h-4 w-4 shrink-0" />
      ) : (
        <BookIcon className="h-4 w-4 shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="truncate">{book.title}</span>
        <span className="text-subtle/40 flex shrink-0 items-center gap-1 text-xs whitespace-nowrap">
          {progress?.percent > 0 && (
            <span>{Math.round(progress.percent)}%</span>
          )}
        </span>
      </div>
    </Button>
  )
}

interface AuthorItemProps {
  author: Author
  isSelected: boolean
  onSelect: (id: string) => void
}

function AuthorItem({ author, isSelected, onSelect }: AuthorItemProps) {
  return (
    <Button
      onClick={() => {
        onSelect(author.id)
      }}
      onContextMenu={useNativeOpen(author.path)}
      className={cn(
        'hover:bg-overlay flex h-8 w-full items-center gap-2 rounded-none px-3 text-left text-sm',
        isSelected ? 'bg-overlay text-love' : 'bg-surface',
      )}
    >
      <Folder className="h-4 w-4 shrink-0" />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="truncate">{author.name}</span>
        <span className="text-subtle/40 text-xs">{author.bookCount}</span>
      </div>
    </Button>
  )
}

interface BookLibraryProps {
  selectedLibrary: Library
}

export function BookLibrary({ selectedLibrary }: BookLibraryProps) {
  const sortedIdsCache = useRef<{ authorId: string; bookIds: string[] }>({
    authorId: '',
    bookIds: [],
  })
  const setNavStatus = useUIStore((s) => s.setNavStatus)
  const { middleClass, readerClass, openReader } = usePanelNav()

  const authorId = useUIStore(
    (s) => s.navStatus[selectedLibrary.id]?.authorId ?? '',
  )
  const bookId = useUIStore(
    (s) => s.navStatus[selectedLibrary.id]?.bookId ?? '',
  )

  const authors = useLibraryStore(
    useShallow((s) => {
      const authorIds = s.libraryAuthors[selectedLibrary.id] ?? []
      return authorIds.map((id) => s.authors[id])
    }),
  )

  const books = useLibraryStore(
    useShallow((s) => {
      if (!authorId) return []

      const bookIds = s.authorBooks[authorId] ?? []

      if (sortedIdsCache.current.authorId !== authorId) {
        const sortedIds = bookIds.toSorted((idA, idB) => {
          const a = s.books[idA]
          const b = s.books[idB]
          if (a.deleted !== b.deleted) return a.deleted ? 1 : -1
          if (a.starred !== b.starred) return a.starred ? -1 : 1
          return 0
        })
        sortedIdsCache.current = { authorId, bookIds: sortedIds }
      }

      return sortedIdsCache.current.bookIds.map((id) => s.books[id])
    }),
  )

  const handleSelectAuthor = (id: string) => {
    if (id === authorId) return
    setNavStatus(selectedLibrary.id, { authorId: id, bookId: '' })
  }

  const handleSelectBook = (id: string) => {
    if (id !== bookId) {
      setNavStatus(selectedLibrary.id, { authorId, bookId: id })
    }
    openReader()
  }

  return (
    <div className="flex h-full w-full">
      <div
        className={cn(
          'min-h-0 w-full flex-1 md:w-auto md:flex-none',
          middleClass,
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col border-r md:w-56 md:flex-none">
          <div className="bg-base text-subtle border-b px-3 py-2 text-xs">
            AUTHORS ({authors.length})
          </div>
          <ScrollArea aria-label="作者列表" viewportClassName="h-0 flex-1">
            {authors.map((author) => (
              <AuthorItem
                key={author.id}
                author={author}
                isSelected={authorId === author.id}
                onSelect={handleSelectAuthor}
              />
            ))}
          </ScrollArea>
        </div>

        <div className="flex min-w-0 flex-1 flex-col border-r md:w-56 md:flex-none">
          <div className="bg-base text-subtle border-b px-3 py-2 text-xs">
            BOOKS ({books.length})
          </div>
          <ScrollArea aria-label="书籍列表" viewportClassName="h-0 flex-1">
            {books.map((book) => (
              <BookItem
                key={book.id}
                book={book}
                isSelected={bookId === book.id}
                onClick={handleSelectBook}
              />
            ))}
          </ScrollArea>
        </div>
      </div>

      <div className={cn('min-h-0 min-w-0 flex-1', readerClass)}>
        {bookId && <BookReader bookId={bookId} showReading />}
      </div>
    </div>
  )
}
