import { Book, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/store/library'
import type { Library } from '@/types/library'
import { BookReader } from './BookReader'

interface BookLibraryProps {
  selectedLibrary: Library
}

export function BookLibrary({ selectedLibrary }: BookLibraryProps) {
  const { updateLibrary } = useLibraryStore()

  const { id, authors = [], status = {} } = selectedLibrary

  const selectedAuthor = authors.find((a) => a.id === status.authorId)
  const books = selectedAuthor?.books ?? []

  const handleSelectAuthor = (authorId: string) => {
    if (authorId === status.authorId) return
    updateLibrary(id, { status: { authorId } })
  }

  const handleSelectBook = (bookId: string) => {
    if (bookId === status.bookId) return
    updateLibrary(id, { status: { authorId: status.authorId, bookId } })
  }

  console.log('Render BookLibrary ---')

  return (
    <div className="flex h-full w-full">
      {/* Column 1: Authors */}
      <div className="flex w-[300px] shrink-0 flex-col overflow-hidden border-r">
        <div className="bg-base text-subtle border-b px-4 py-2 text-xs uppercase">
          Authors ({authors.length})
        </div>
        <ScrollArea className="h-0 flex-1">
          {authors.map((author) => (
            <Button
              key={author.id}
              onClick={() => handleSelectAuthor(author.id)}
              className={cn(
                'hover:bg-overlay flex h-8 w-full items-center gap-2 rounded-none px-3 text-left text-sm transition-colors',
                status.authorId === author.id ? 'bg-overlay' : 'bg-surface',
              )}
            >
              <Folder className="h-4 w-4 shrink-0" />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="truncate">{author.name}</span>
                <span className="text-subtle/60 text-xs">
                  {author.books?.length}
                </span>
              </div>
            </Button>
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
            <Button
              key={book.id}
              onClick={() => handleSelectBook(book.id)}
              className={cn(
                'hover:bg-overlay flex h-8 w-full items-center gap-2 rounded-none px-3 text-left text-sm transition-colors',
                status.bookId === book.id ? 'bg-overlay' : 'bg-surface',
              )}
            >
              <Book className="h-4 w-4 shrink-0" />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="truncate">{book.title}</span>
                <span className="text-subtle/60 flex shrink-0 items-center gap-1 text-xs whitespace-nowrap">
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
