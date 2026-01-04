import { Book as BookIcon, Folder, Star, Trash2 } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import type { Author, Book, Library } from '@/types/library'
import { BookReader } from './book-reader'

interface BookLibraryProps {
  selectedLibrary: Library
}

interface BookListItemProps {
  book: Book
  isSelected: boolean
  onClick: (id: string) => void
}

const BookListItem = memo(
  ({ book, isSelected, onClick }: BookListItemProps) => {
    const progress = useProgressStore((s) => s.books[book.id])

    return (
      <Button
        onClick={() => onClick(book.id)}
        className={cn(
          'hover:bg-overlay flex h-8 w-full items-center gap-2 rounded-none px-3 text-left text-sm transition-colors',
          isSelected ? 'bg-overlay' : 'bg-surface',
          book.deleted && 'text-subtle/60',
        )}
      >
        {book.deleted ? (
          <Trash2 className="z-10 h-4 w-4 shrink-0" />
        ) : book.starred ? (
          <Star className="text-love fill-gold/80 z-10 h-4 w-4 shrink-0" />
        ) : (
          <BookIcon className="z-10 h-4 w-4 shrink-0" />
        )}
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate">{book.title}</span>
          <span className="text-subtle/60 flex shrink-0 items-center gap-1 text-xs whitespace-nowrap">
            {progress && progress.percent > 0 && (
              <>
                <span>{Math.round(progress.percent)}%</span>
                <span>•</span>
              </>
            )}
            <span>{(book.size / 1024).toFixed(1)}k</span>
          </span>
        </div>
      </Button>
    )
  },
)
BookListItem.displayName = 'BookListItem'

interface AuthorListItemProps {
  author: Author
  isSelected: boolean
  onSelect: (id: string) => void
}

const AuthorListItem = memo(
  ({ author, isSelected, onSelect }: AuthorListItemProps) => (
    <Button
      onClick={() => onSelect(author.id)}
      className={cn(
        'hover:bg-overlay flex h-8 w-full items-center gap-2 rounded-none px-3 text-left text-sm transition-colors',
        isSelected ? 'bg-overlay' : 'bg-surface',
      )}
    >
      <Folder className="h-4 w-4 shrink-0" />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="truncate">{author.name}</span>
        <span className="text-subtle/60 text-xs">{author.bookCount}</span>
      </div>
    </Button>
  ),
)
AuthorListItem.displayName = 'AuthorListItem'

export function BookLibrary({ selectedLibrary }: BookLibraryProps) {
  const updateLibrary = useLibraryStore((s) => s.updateLibrary)

  const { authorId, bookId } = selectedLibrary.status

  const authors = useLibraryStore(
    useShallow((s) => {
      const authorIds = s.libraryAuthors[selectedLibrary.id]
      return authorIds.map((id) => s.authors[id])
    }),
  )

  const books = useLibraryStore(
    useShallow((s) => {
      if (!authorId) return []
      const bookIds = s.authorBooks[authorId]
      return bookIds.map((id) => s.books[id])
    }),
  )

  const handleSelectAuthor = useCallback(
    (id: string) => {
      if (id === authorId) return
      updateLibrary(selectedLibrary.id, {
        status: { authorId: id, bookId: '' },
      })
    },
    [selectedLibrary.id, updateLibrary, authorId],
  )

  const handleSelectBook = useCallback(
    (id: string) => {
      if (id === bookId) return
      updateLibrary(selectedLibrary.id, { status: { authorId, bookId: id } })
    },
    [selectedLibrary.id, updateLibrary, authorId, bookId],
  )

  return (
    <div className="flex h-full w-full">
      {/* Column 1: Authors */}
      <div className="flex w-[300px] shrink-0 flex-col overflow-hidden border-r">
        <div className="bg-base text-subtle border-b px-4 py-2 text-xs uppercase">
          Authors ({authors.length})
        </div>
        <ScrollArea className="h-0 flex-1">
          {authors.map((author) => (
            <AuthorListItem
              key={author.id}
              author={author}
              isSelected={authorId === author.id}
              onSelect={handleSelectAuthor}
            />
          ))}
        </ScrollArea>
      </div>

      {/* Column 2: Books */}
      <div className="flex w-[300px] shrink-0 flex-col overflow-hidden border-r">
        <div className="bg-base text-subtle border-b px-4 py-2 text-xs uppercase">
          Books ({books.length})
        </div>
        <ScrollArea className="h-0 flex-1">
          {books.map((book) => (
            <BookListItem
              key={book.id}
              book={book}
              isSelected={bookId === book.id}
              onClick={handleSelectBook}
            />
          ))}
        </ScrollArea>
      </div>

      {/* Column 3: Preview */}
      {bookId && <BookReader bookId={bookId} showReading />}
    </div>
  )
}
