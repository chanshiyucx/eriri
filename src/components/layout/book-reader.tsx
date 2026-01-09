import { SquareMenu, Star, StepForward, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  findLineIndexByOffset,
  parseBook,
  type BookContent,
  type Chapter,
} from '@/lib/book'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import { LibraryType, type FileTags } from '@/types/library'

const BookLine = memo(function BookLine({ line }: { line: string }) {
  return (
    <p className="text-text mx-auto w-full max-w-3xl px-8 pb-4 font-serif leading-relaxed break-words whitespace-pre-wrap">
      {line}
    </p>
  )
})

const BookHeader = memo(function BookHeader() {
  return <div className="h-16" />
})

const BookFooter = memo(function BookFooter() {
  return <div className="h-32" />
})

const VIRTUOSO_COMPONENTS = {
  Header: BookHeader,
  Footer: BookFooter,
}

interface TableOfContentsProps {
  chapters: Chapter[]
  currentChapterTitle: string
  isCollapsed: boolean
  onSelect: (lineIndex: number) => void
}

const TableOfContents = memo(function TableOfContents({
  chapters,
  currentChapterTitle,
  isCollapsed,
  onSelect,
}: TableOfContentsProps) {
  return (
    <div
      className={cn(
        'bg-base absolute top-8 left-0 z-100 h-full w-64 transition-all duration-300 ease-in-out',
        isCollapsed ? '-translate-x-full' : 'translate-x-0',
      )}
    >
      <ScrollArea className="h-full">
        <div className="pb-12">
          {chapters.map((chapter, i) => (
            <div
              key={i}
              className={cn(
                'hover:bg-overlay w-full cursor-pointer truncate px-4 py-2 text-left text-sm',
                currentChapterTitle === chapter.title && 'bg-overlay text-love',
              )}
              onClick={() => onSelect(chapter.lineIndex)}
            >
              {chapter.title}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
})

interface BookReaderProps {
  bookId: string
  showReading?: boolean
}

export const BookReader = memo(function BookReader({
  bookId,
  showReading = false,
}: BookReaderProps) {
  const [content, setContent] = useState<BookContent | null>(null)
  const [currentChapterTitle, setCurrentChapterTitle] = useState<string>('')
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [isTocCollapsed, setTocCollapsed] = useState(true)
  const currentChapterRef = useRef(currentChapterTitle)

  const book = useLibraryStore((s) => s.books[bookId])
  const updateBookTags = useLibraryStore((s) => s.updateBookTags)
  const updateBookProgress = useProgressStore((s) => s.updateBookProgress)
  const activeTab = useTabsStore((s) => s.activeTab)
  const addTab = useTabsStore((s) => s.addTab)
  const setActiveTab = useTabsStore((s) => s.setActiveTab)

  const memoizedLines = useMemo(() => content?.lines ?? [], [content])
  const totalChars = useMemo(() => content?.totalChars ?? 0, [content])

  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestProgressRef = useRef<{
    startCharIndex: number
    totalChars: number
    percent: number
    currentChapterTitle?: string
  } | null>(null)

  currentChapterRef.current = currentChapterTitle

  const stateRef = useRef({ activeTab, book })
  stateRef.current = { activeTab, book }

  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
        throttleTimeoutRef.current = null
      }
      if (latestProgressRef.current) {
        updateBookProgress(bookId, {
          ...latestProgressRef.current,
          lastRead: Date.now(),
        })
        latestProgressRef.current = null
      }
    }
  }, [bookId, updateBookProgress])

  useEffect(() => {
    if (!book.path) return
    let mounted = true
    const load = async () => {
      try {
        const data = await parseBook(book.path)
        if (mounted) {
          setContent(data)
        }
      } catch (e) {
        console.error('Failed to load book', e)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [book.path])

  const initialTopIndex = useMemo(() => {
    if (!content) return 0
    const progress = useProgressStore.getState().books[bookId]

    if (progress?.startCharIndex) {
      return findLineIndexByOffset(
        content.lineStartOffsets,
        progress.startCharIndex,
      )
    } else if (progress?.percent) {
      return Math.floor((progress.percent / 100) * content.lines.length)
    }
    return 0
  }, [content, bookId])

  const toggleToc = useCallback(() => {
    setTocCollapsed((prev) => !prev)
  }, [])

  const handleChapterClick = useCallback((lineIndex: number) => {
    virtuosoRef.current?.scrollToIndex({
      index: lineIndex,
      align: 'start',
    })
  }, [])

  const handleContinueReading = useCallback(() => {
    if (!book || activeTab === book.path) return
    addTab({
      type: LibraryType.book,
      id: book.id,
      title: book.title,
      path: book.path,
    })
    setActiveTab(book.path)
  }, [addTab, activeTab, setActiveTab, book])

  const handleSetBookTags = useCallback(
    (tags: FileTags) => {
      void updateBookTags(book.id, tags)
    },
    [updateBookTags, book.id],
  )

  const handleRangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      if (!content) return

      const totalLines = content.lines.length
      const currentLine = range.startIndex
      const safeLineIndex = Math.min(Math.max(0, currentLine), totalLines - 1)
      const percent =
        totalLines > 1 ? (safeLineIndex / (totalLines - 1)) * 100 : 0

      const startCharIndex = content.lineStartOffsets[safeLineIndex] ?? 0

      const match = content.chapters.findLast(
        (c) => c.lineIndex <= safeLineIndex,
      )
      const chapterTitle = match?.title ?? ''

      if (chapterTitle !== currentChapterRef.current) {
        setCurrentChapterTitle(chapterTitle)
      }

      const newProgress = {
        startCharIndex,
        totalChars,
        percent,
        currentChapterTitle: chapterTitle,
      }

      latestProgressRef.current = newProgress

      throttleTimeoutRef.current ??= setTimeout(() => {
        if (latestProgressRef.current) {
          updateBookProgress(bookId, {
            ...latestProgressRef.current,
            lastRead: Date.now(),
          })
        }
        throttleTimeoutRef.current = null
      }, 300)
    },
    [content, bookId, updateBookProgress, totalChars],
  )

  const renderItem = useCallback(
    (_index: number, line: string) => <BookLine line={line} />,
    [],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation()

      const { activeTab, book } = stateRef.current
      if (activeTab || !book) return

      const key = e.key.toUpperCase()
      if (key === 'T') {
        toggleToc()
      } else if (key === 'C') {
        void handleSetBookTags({ deleted: !book.deleted })
      } else if (key === 'V') {
        void handleSetBookTags({ starred: !book.starred })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSetBookTags, toggleToc])

  if (!book) return null

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {content?.chapters && (
        <TableOfContents
          chapters={content.chapters}
          currentChapterTitle={currentChapterTitle}
          isCollapsed={isTocCollapsed}
          onSelect={handleChapterClick}
        />
      )}

      <div className="bg-base text-subtle flex h-8 w-full items-center gap-2 border-b px-2 text-xs">
        <Button
          className="hover:bg-overlay mx-1 h-6 w-6 bg-transparent"
          onClick={toggleToc}
          title="展开目录"
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
          onClick={() => void handleSetBookTags({ deleted: !book.deleted })}
          title="标记删除"
        >
          <Trash2
            className={cn('h-4 w-4', book.deleted && 'text-love fill-gold/80')}
          />
        </Button>

        <Button
          className="h-6 w-6"
          onClick={() => void handleSetBookTags({ starred: !book.starred })}
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
        className="h-full w-full flex-1"
        data={memoizedLines}
        totalCount={memoizedLines.length}
        initialTopMostItemIndex={initialTopIndex}
        rangeChanged={handleRangeChanged}
        itemContent={renderItem}
        components={VIRTUOSO_COMPONENTS}
        increaseViewportBy={{ top: 0, bottom: 200 }}
      />
    </div>
  )
})
