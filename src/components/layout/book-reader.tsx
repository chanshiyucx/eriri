import { throttle } from 'lodash-es'
import { SquareMenu, Star, StepForward, Trash2 } from 'lucide-react'
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ReaderPadding } from '@/components/ui/virtuoso-config'
import { useClickOutside } from '@/hooks/use-click-outside'
import { parseBook } from '@/lib/scanner'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import {
  LibraryType,
  type BookContent,
  type BookProgress,
  type Chapter,
  type FileTags,
} from '@/types/library'

const EMPTY_LINES: string[] = []

const BookLine = memo(function BookLine({ line }: { line: string }) {
  return (
    <p className="text-text mx-auto w-full max-w-3xl px-8 pb-4 font-serif leading-relaxed break-words whitespace-pre-wrap">
      {line}
    </p>
  )
})

interface TableOfContentsProps {
  chapters: Chapter[]
  currentChapterTitle: string
  isCollapsed: boolean
  onSelect: (lineIndex: number) => void
  onClose: () => void
}

const TableOfContents = memo(function TableOfContents({
  chapters,
  currentChapterTitle,
  isCollapsed,
  onSelect,
  onClose,
}: TableOfContentsProps) {
  const tocRef = useRef<HTMLDivElement>(null)

  useClickOutside(tocRef, onClose, !isCollapsed)

  return (
    <div
      ref={tocRef}
      className={cn(
        'bg-base absolute top-8 left-0 z-100 h-full w-64 transition-all duration-300 ease-in-out',
        isCollapsed ? '-translate-x-full' : 'translate-x-0',
      )}
    >
      <ScrollArea viewportClassName="h-full" className="pb-12">
        {chapters.map((chapter) => (
          <div
            key={chapter.lineIndex}
            className={cn(
              'hover:bg-overlay w-full cursor-pointer truncate px-4 py-2 text-left text-sm',
              currentChapterTitle === chapter.title && 'bg-overlay text-love',
            )}
            onClick={() => onSelect(chapter.lineIndex)}
          >
            {chapter.title}
          </div>
        ))}
      </ScrollArea>
    </div>
  )
})

interface BookData {
  bookId: string
  content: BookContent
}

interface BookReaderProps {
  bookId: string
  showReading?: boolean
}

export const BookReader = memo(function BookReader({
  bookId,
  showReading = false,
}: BookReaderProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const isLock = useRef(false)
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isTocCollapsed, setTocCollapsed] = useState(true)
  const [bookData, setBookData] = useState<BookData | null>(null)

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

  const stateRef = useRef({
    activeTab,
    book,
    content,
    currentIndex,
    currentChapterTitle,
  })
  // eslint-disable-next-line react-hooks/refs
  stateRef.current = {
    activeTab,
    book,
    content,
    currentIndex,
    currentChapterTitle,
  }

  const throttledUpdateProgress = useRef(
    throttle(
      (bookId: string, progress: BookProgress) =>
        updateBookProgress(bookId, progress),
      300,
      { leading: false, trailing: true },
    ),
  )

  useEffect(() => {
    const throttled = throttledUpdateProgress.current
    return () => {
      throttled.flush()
      throttled.cancel()
    }
  }, [])

  useEffect(() => {
    if (!book.path) return
    const load = async () => {
      try {
        const data = await parseBook(book.path)
        setBookData({ bookId, content: data })
      } catch (e) {
        console.error('Failed to load book', e)
      }
    }
    void load()
  }, [bookId, book.path])

  const lockScroll = useCallback(() => {
    if (lockTimer.current) {
      clearTimeout(lockTimer.current)
    }
    console.log('滚动锁定')
    isLock.current = true
    lockTimer.current = setTimeout(() => {
      console.log('解除锁定')
      isLock.current = false
    }, 500)
  }, [])

  const jumpTo = useCallback(
    (index: number) => {
      console.log('跳转索引：', index)
      const { content, book } = stateRef.current
      if (!content) return

      const total = content.lines.length ?? 0
      const percent = total > 1 ? (index / (total - 1)) * 100 : 100
      const match = content.chapters.findLast((c) => c.lineIndex <= index)
      const chapterTitle = match?.title ?? ''
      const newProgress: BookProgress = {
        current: index,
        total,
        percent,
        currentChapterTitle: chapterTitle,
        lastRead: Date.now(),
      }

      updateBookProgress(book.id, newProgress)

      lockScroll()
      virtuosoRef.current?.scrollToIndex({
        index,
        align: 'start',
      })
    },
    [updateBookProgress, lockScroll],
  )

  useLayoutEffect(() => {
    const { activeTab, book, content, currentIndex } = stateRef.current
    if (!content || (activeTab && activeTab !== book.id)) return
    jumpTo(currentIndex)
  }, [activeTab, jumpTo])

  const handleRangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      if (isLock.current) return

      const { book, content } = stateRef.current
      if (!content) return

      const total = content.lines.length
      const newIndex = range.startIndex
      const percent = total > 1 ? (newIndex / (total - 1)) * 100 : 100
      const match = content.chapters.findLast((c) => c.lineIndex <= newIndex)
      const chapterTitle = match?.title ?? ''
      const newProgress: BookProgress = {
        current: newIndex,
        total,
        percent,
        currentChapterTitle: chapterTitle,
        lastRead: Date.now(),
      }

      throttledUpdateProgress.current(book.id, newProgress)
    },
    [],
  )

  const toggleToc = useCallback(() => {
    const { content } = stateRef.current
    if (!content?.chapters.length) return
    setTocCollapsed((prev) => !prev)
  }, [])

  const handleCloseToc = useCallback(() => {
    setTocCollapsed(true)
  }, [])

  const handleContinueReading = useCallback(() => {
    const { activeTab, book } = stateRef.current
    if (!book || activeTab === book.id) return
    addTab({
      type: LibraryType.book,
      id: book.id,
      title: book.title,
    })
    setActiveTab(book.id)
  }, [addTab, setActiveTab])

  const handleSetBookTags = useCallback(
    (tags: FileTags) => {
      void updateBookTags(book.id, tags)
    },
    [updateBookTags, book.id],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const { activeTab, book } = stateRef.current
      if (!book) return
      if (activeTab && activeTab !== book.id) return

      switch (e.code) {
        case 'KeyT':
          toggleToc()
          break
        case 'KeyC':
          handleSetBookTags({ deleted: !book.deleted })
          break
        case 'KeyV':
          handleSetBookTags({ starred: !book.starred })
          break
        case 'KeyP':
          handleContinueReading()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSetBookTags, toggleToc, handleContinueReading])

  const renderItem = useCallback(
    (_index: number, line: string) => <BookLine line={line} />,
    [],
  )

  if (!book || !content) return null

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {content.chapters && (
        <TableOfContents
          chapters={content.chapters}
          currentChapterTitle={currentChapterTitle}
          isCollapsed={isTocCollapsed}
          onSelect={jumpTo}
          onClose={handleCloseToc}
        />
      )}

      <div className="bg-base text-subtle flex h-8 w-full items-center gap-2 border-b px-2 text-xs">
        <Button
          className="hover:bg-overlay mx-1 h-6 w-6 bg-transparent"
          onClick={toggleToc}
          onMouseDown={(e) => e.stopPropagation()}
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
          onClick={() => handleSetBookTags({ deleted: !book.deleted })}
          title="标记删除"
        >
          <Trash2
            className={cn('h-4 w-4', book.deleted && 'text-love fill-gold/80')}
          />
        </Button>

        <Button
          className="h-6 w-6"
          onClick={() => handleSetBookTags({ starred: !book.starred })}
          title="标记收藏"
        >
          <Star
            className={cn('h-4 w-4', book.starred && 'text-love fill-gold/80')}
          />
        </Button>

        <h3 className="flex-1 truncate text-center">
          {currentChapterTitle || book.title}
        </h3>
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
})
