import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Loader2, Menu, Settings, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BookContent, Chapter, parseBook } from '@/lib/book-utils'
import { cn } from '@/lib/utils'

interface BookReaderProps {
  bookPath: string
  initialProgress?: {
    startCharIndex?: number
    percent?: number
  }
  onExit: () => void
  onProgressUpdate: (progress: {
    startCharIndex: number
    totalChars: number
    percent: number
    currentChapterTitle?: string
  }) => void
  mode?: 'full' | 'preview'
}

export function BookReader({
  bookPath,
  initialProgress,
  onExit,
  onProgressUpdate,
  mode = 'full',
}: BookReaderProps) {
  const [content, setContent] = useState<BookContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [showToc, setShowToc] = useState(false)
  const [currentChapterTitle, setCurrentChapterTitle] = useState<string>('')

  // Track reading progress for UI display
  const [, setProgressPercent] = useState(0)

  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const restoredRef = useRef(false)

  useEffect(() => {
    restoredRef.current = false
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        const data = await parseBook(bookPath)
        if (mounted) {
          setContent(data)
        }
      } catch (e) {
        console.error('Failed to load book', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
      // Flush pending progress when bookPath changes (switching books)
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
        throttleTimeoutRef.current = null
      }
      if (latestProgressRef.current) {
        onProgressUpdateRef.current(latestProgressRef.current)
        latestProgressRef.current = null
      }
    }
  }, [bookPath])

  // Restore initial progress - use serialized comparison to avoid re-scrolling on object recreation
  const initialProgressKey = initialProgress
    ? JSON.stringify({
        startCharIndex: initialProgress.startCharIndex,
        percent: initialProgress.percent,
      })
    : ''

  useEffect(() => {
    if (!content || !virtuosoRef.current) return

    // If we've already restored progress for this book, don't do it again
    // This prevents the "infinite loop" of progress updates -> prop update -> restore -> scroll
    if (restoredRef.current) return

    // If no initial progress to restore, mark as restored and we're done
    if (!initialProgressKey) {
      restoredRef.current = true
      return
    }

    // Allow a small delay for Virtuoso to initialize
    const timer = setTimeout(() => {
      if (!virtuosoRef.current) return

      if (initialProgress?.startCharIndex) {
        // Find line by char offset
        let targetLine = 0
        if (content.lineStartOffsets) {
          for (let i = 0; i < content.lineStartOffsets.length; i++) {
            if (content.lineStartOffsets[i] > initialProgress.startCharIndex) {
              targetLine = Math.max(0, i - 1)
              break
            }
            targetLine = i
          }
        }
        // Use Virtuoso's scrollToIndex
        virtuosoRef.current.scrollToIndex({
          index: targetLine,
          align: 'start',
          behavior: 'auto',
        })
      } else if (initialProgress?.percent) {
        const targetLine = Math.floor(
          (initialProgress.percent / 100) * content.lines.length,
        )
        virtuosoRef.current.scrollToIndex({
          index: targetLine,
          align: 'start',
          behavior: 'auto',
        })
      }

      // Mark as restored after successful scroll
      restoredRef.current = true
    }, 100)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, initialProgressKey]) // Use serialized key instead of object reference

  /*
   * Throttled progress update to ensure performance.
   * We use a ref to hold the timeout ID and the latest progress data.
   */
  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestProgressRef = useRef<{
    startCharIndex: number
    totalChars: number
    percent: number
    currentChapterTitle?: string
  } | null>(null)

  // Need to persist onProgressUpdate to use in cleanup
  const onProgressUpdateRef = useRef(onProgressUpdate)
  useEffect(() => {
    onProgressUpdateRef.current = onProgressUpdate
  }, [onProgressUpdate])

  // Cleanup throttle on unmount and ensure last update is sent
  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
        throttleTimeoutRef.current = null
      }
      // If we have pending progress, flush it immediately
      if (latestProgressRef.current) {
        onProgressUpdateRef.current(latestProgressRef.current)
      }
    }
  }, [])

  /*
   * Handle range changes from Virtuoso to track progress.
   * Virtuoso calls this when the visible range changes.
   */
  const handleRangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      if (!content) return

      const totalLines = content.lines.length
      // Use the top of visible range as current position for stable restoration
      const currentLine = range.startIndex
      const safeLineIndex = Math.min(Math.max(0, currentLine), totalLines - 1)
      const percent = (safeLineIndex / (totalLines - 1)) * 100

      setProgressPercent(percent)

      const startCharIndex = content.lineStartOffsets[safeLineIndex] ?? 0
      const totalChars =
        content.lineStartOffsets[content.lineStartOffsets.length - 1] +
        (content.lines[content.lines.length - 1]?.length || 0)

      // Find current chapter
      let chapterTitle = ''
      if (content?.chapters) {
        const reversedChapters = [...content.chapters].reverse() // Search from end
        const match = reversedChapters.find((c) => c.lineIndex <= safeLineIndex)
        if (match) {
          chapterTitle = match.title
        }
      }

      if (chapterTitle !== currentChapterTitle) {
        setCurrentChapterTitle(chapterTitle)
      }

      const newProgress = {
        startCharIndex,
        totalChars,
        percent,
        currentChapterTitle: chapterTitle,
      }

      // Store latest
      latestProgressRef.current = newProgress

      // Throttle execution
      throttleTimeoutRef.current ??= setTimeout(() => {
        if (latestProgressRef.current) {
          onProgressUpdateRef.current(latestProgressRef.current)
        }
        throttleTimeoutRef.current = null
      }, 300) // 300ms throttle for more responsive updates
    },
    [content, currentChapterTitle],
  )

  const jumpToChapter = (chapter: Chapter) => {
    setShowToc(false)
    // Use Virtuoso's scrollToIndex
    virtuosoRef.current?.scrollToIndex({
      index: chapter.lineIndex,
      align: 'start',
      behavior: 'smooth',
    })
  }

  // Keyboard support for TOC and exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showToc) setShowToc(false)
        else onExit()
      }
    }

    if (mode === 'full') {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mode, showToc, onExit])

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <span className="ml-2">Loading book...</span>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p>Failed to load content</p>
        <Button onClick={onExit} variant="link">
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-surface relative flex h-full w-full overflow-hidden">
      {/* Sidebar TOC - Only in full mode */}
      <AnimatePresence>
        {showToc && mode === 'full' && (
          <>
            <div
              className="absolute inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setShowToc(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="bg-background absolute top-0 bottom-0 left-0 z-50 w-80 border-r shadow-xl"
            >
              <div className="flex items-center justify-between border-b p-4">
                <h2 className="font-semibold">目录</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowToc(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="h-[calc(100%-60px)]">
                <div className="flex flex-col p-2">
                  {content.chapters.map((chapter, i) => (
                    <button
                      key={i}
                      className="hover:bg-accent hover:text-accent-foreground cursor-pointer truncate rounded-sm px-4 py-3 text-left text-sm transition-colors"
                      onClick={() => jumpToChapter(chapter)}
                    >
                      {chapter.title}
                    </button>
                  ))}
                  {content.chapters.length === 0 && (
                    <div className="text-muted-foreground p-4 text-center">
                      No chapters found
                    </div>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="relative flex h-full flex-1 flex-col">
        {/* Header Controls - Only in full mode */}
        {mode === 'full' && (
          <div className="bg-background/95 absolute top-0 z-10 flex w-full items-center justify-between border-b p-4 opacity-0 backdrop-blur transition-opacity duration-300 hover:opacity-100">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onExit}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowToc(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
            <div className="text-sm font-medium">
              {/* Title or Chapter? For now empty or Book Name if we had it */}
              Reading
            </div>
            <div>
              <Button variant="ghost" size="icon" disabled>
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Preview Header - Only in preview mode */}
        {mode === 'preview' && currentChapterTitle && (
          <div className="bg-base text-subtle absolute top-0 z-10 w-full p-2 text-center text-xs font-medium">
            {currentChapterTitle}
          </div>
        )}

        {/* Text Scroll Area with Virtual Scrolling */}
        <Virtuoso
          ref={virtuosoRef}
          className="w-full flex-1"
          style={{ height: '100%' }}
          data={content.lines}
          totalCount={content.lines.length}
          rangeChanged={handleRangeChanged}
          itemContent={(index, line) => (
            <div className="mx-auto w-full max-w-3xl px-8">
              <p
                id={`line-${index}`}
                className={cn(
                  'text-foreground/90 mb-4 font-serif text-lg leading-relaxed break-words whitespace-pre-wrap',
                  mode === 'preview' && 'mb-2 text-base', // Smaller text in preview
                )}
              >
                {line || '\u00A0'}
              </p>
            </div>
          )}
          components={{
            Header: () => <div className="h-16" />,
            Footer: () => <div className="h-[50vh]" />,
          }}
        />
      </div>
    </div>
  )
}
