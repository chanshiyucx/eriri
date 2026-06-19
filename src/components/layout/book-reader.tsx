import { SquareMenu, Star, StepForward, Trash2 } from 'lucide-react'
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { useClickOutside } from '@/hooks/use-click-outside'
import { useScrollLock } from '@/hooks/use-scroll-lock'
import { useThrottledProgress } from '@/hooks/use-throttled-progress'
import { createBookProgress } from '@/lib/progress'
import { parseBook } from '@/lib/scanner'
import { SHORTCUTS } from '@/lib/shortcuts'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import { LibraryType, type BookContent, type Chapter } from '@/types/library'

const EMPTY_LINES: string[] = []
const EMPTY_FAVORITES: number[] = []

const ReaderPadding = {
  Header: () => <div className="h-16" />,
  Footer: () => <div className="h-16" />,
}

function BookLine({ line }: { line: string }) {
  return (
    <p className="text-text mx-auto w-full px-4 pb-4 font-serif leading-relaxed wrap-break-word whitespace-pre-wrap select-text!">
      {line}
    </p>
  )
}

interface TableOfContentsProps {
  chapters: Chapter[]
  currentChapterTitle: string
  isCollapsed: boolean
  favorites: number[]
  onSelect: (lineIndex: number) => void
  onToggleFavorite: (lineIndex: number) => void
  onClose: () => void
}

function TableOfContents({
  chapters,
  currentChapterTitle,
  isCollapsed,
  favorites,
  onSelect,
  onToggleFavorite,
  onClose,
}: TableOfContentsProps) {
  const tocRef = useRef<HTMLDivElement>(null)
  const favoriteSet = new Set(favorites)

  useClickOutside(tocRef, onClose, !isCollapsed)

  return (
    <div
      ref={tocRef}
      className={cn(
        'bg-base absolute top-8 left-0 z-100 h-full w-64 transition-transform duration-300 ease-in-out',
        isCollapsed ? '-translate-x-full' : 'translate-x-0',
      )}
    >
      <ScrollArea viewportClassName="h-full" className="pb-12">
        {chapters.map((chapter) => {
          const isFavorite = favoriteSet.has(chapter.lineIndex)
          const isActiveLine = currentChapterTitle === chapter.title
          return (
            <div
              key={chapter.lineIndex}
              className="group hover:bg-overlay flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm"
              onClick={() => {
                onSelect(chapter.lineIndex)
              }}
            >
              <span
                className={cn(
                  'min-w-0 flex-1 truncate',
                  isActiveLine && 'text-love',
                )}
              >
                {chapter.title}
              </span>
              <button
                type="button"
                className={cn(
                  'shrink-0 transition-opacity',
                  isFavorite
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100',
                )}
                title="收藏章节"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFavorite(chapter.lineIndex)
                }}
              >
                <Star
                  className={cn(
                    'h-4 w-4',
                    isFavorite && 'text-love fill-gold/80',
                  )}
                />
              </button>
            </div>
          )
        })}
      </ScrollArea>
    </div>
  )
}

interface BookData {
  bookId: string
  content: BookContent
}

interface BookReaderProps {
  bookId: string
  showReading?: boolean
}

export function BookReader({ bookId, showReading = false }: BookReaderProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [isTocCollapsed, setTocCollapsed] = useState(true)
  const [bookData, setBookData] = useState<BookData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)

  const book = useLibraryStore((s) => s.books[bookId])
  const updateBookTags = useLibraryStore((s) => s.updateBookTags)
  const activeTab = useTabsStore((s) => s.activeTab)
  const addTab = useTabsStore((s) => s.addTab)
  const setActiveTab = useTabsStore((s) => s.setActiveTab)

  const content = bookData?.bookId === bookId ? bookData.content : null
  const lines = content?.lines ?? EMPTY_LINES

  const updateBookProgress = useProgressStore((s) => s.updateBookProgress)
  const progress = useProgressStore((s) => s.books[bookId])
  const currentIndex = progress?.current ?? 0
  const currentChapterTitle = progress?.currentChapterTitle ?? ''

  const toggleChapterFavorite = useProgressStore((s) => s.toggleChapterFavorite)
  const favoriteChapters = useProgressStore(
    (s) => s.favoriteChapters[bookId] ?? EMPTY_FAVORITES,
  )

  const { isLock, lockScroll } = useScrollLock()
  const throttledUpdateProgress = useThrottledProgress(updateBookProgress)

  const jumpTo = (targetIndex?: number) => {
    if (!content) return

    const index = targetIndex ?? currentIndex
    const newProgress = createBookProgress(
      index,
      content.lines.length,
      content.chapters,
    )
    updateBookProgress(book.id, newProgress)

    lockScroll()
    virtuosoRef.current?.scrollToIndex({
      index,
      align: 'start',
    })
  }
  const jumpToFn = useEffectEvent(jumpTo)

  useEffect(() => {
    if (!book?.path) return
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setLoadProgress(0)
      try {
        const data = await parseBook(book.path, (percent) => {
          if (!cancelled) setLoadProgress(percent)
        })
        if (!cancelled) setBookData({ bookId, content: data })
      } catch (e) {
        console.error('Failed to load book', e)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [bookId, book?.path])

  useLayoutEffect(() => {
    lockScroll()
  }, [lockScroll, bookId])

  useLayoutEffect(() => {
    jumpToFn()
  }, [activeTab])

  const handleRangeChanged = (range: {
    startIndex: number
    endIndex: number
  }) => {
    if (isLock.current) return

    if (!content) return

    const newProgress = createBookProgress(
      range.startIndex,
      content.lines.length,
      content.chapters,
    )
    throttledUpdateProgress.current(book.id, newProgress)
  }

  const toggleToc = () => {
    if (!content?.chapters.length) return
    setTocCollapsed((prev) => !prev)
  }

  const handleContinueReading = () => {
    if (!book || activeTab === book.id) return
    addTab({
      type: LibraryType.book,
      id: book.id,
      title: book.title,
    })
    setActiveTab(book.id)
  }

  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (!book) return
    if (activeTab && activeTab !== book.id) return

    switch (e.code) {
      case SHORTCUTS.toggleToc:
        toggleToc()
        break
      case SHORTCUTS.toggleItemDeleted:
        void updateBookTags(book.id, { deleted: !book.deleted })
        break
      case SHORTCUTS.toggleItemStarred:
        void updateBookTags(book.id, { starred: !book.starred })
        break
      case SHORTCUTS.continueReading:
        handleContinueReading()
        break
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const renderItem = (_index: number, line: string) => <BookLine line={line} />

  if (!book) return null

  if (!content) {
    return (
      <div className="bg-surface text-subtle flex h-full w-full flex-col items-center justify-center gap-3">
        {isLoading && (
          <>
            <Spinner size="large" />
            {loadProgress > 0 && (
              <span className="text-xs tabular-nums">{loadProgress}%</span>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {content.chapters && (
        <TableOfContents
          chapters={content.chapters}
          currentChapterTitle={currentChapterTitle}
          isCollapsed={isTocCollapsed}
          favorites={favoriteChapters}
          onSelect={jumpTo}
          onToggleFavorite={(lineIndex) => {
            toggleChapterFavorite(bookId, lineIndex)
          }}
          onClose={() => {
            setTocCollapsed(true)
          }}
        />
      )}

      <div className="bg-base text-subtle relative flex h-8 items-center justify-between border-b px-3 text-xs">
        <div className="flex shrink-0 gap-2">
          <Button
            className="hover:bg-overlay h-6 w-6 bg-transparent"
            onClick={toggleToc}
            onMouseDown={(e) => {
              e.stopPropagation()
            }}
            title="展开目录"
            disabled={!content.chapters.length}
          >
            <SquareMenu className="h-4 w-4" />
          </Button>

          {showReading && (
            <Button
              className="h-6 w-6"
              onClick={handleContinueReading}
              title="继续阅读"
            >
              <StepForward className="h-4 w-4" />
            </Button>
          )}

          <Button
            className="h-6 w-6"
            onClick={() =>
              void updateBookTags(book.id, { deleted: !book.deleted })
            }
            title="标记删除"
          >
            <Trash2
              className={cn('h-4 w-4', book.deleted && 'text-subtle/40')}
            />
          </Button>

          <Button
            className="h-6 w-6"
            onClick={() =>
              void updateBookTags(book.id, { starred: !book.starred })
            }
            title="标记收藏"
          >
            <Star
              className={cn(
                'h-4 w-4',
                book.starred && 'text-love fill-gold/80',
              )}
            />
          </Button>
        </div>

        <h3 className="mx-2 min-w-0 flex-1 truncate text-left">
          {currentChapterTitle || book.title}
        </h3>

        <div className="flex shrink-0 gap-2 whitespace-nowrap">
          {progress?.percent > 0 && (
            <span>{Math.round(progress.percent)}%</span>
          )}
        </div>
      </div>

      <Virtuoso
        key={bookId}
        ref={virtuosoRef}
        className="flex-1"
        data={lines}
        initialTopMostItemIndex={currentIndex}
        rangeChanged={handleRangeChanged}
        itemContent={renderItem}
        components={ReaderPadding}
        increaseViewportBy={{ top: 0, bottom: 200 }}
      />
    </div>
  )
}
