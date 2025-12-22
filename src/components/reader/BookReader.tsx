import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Loader2, Menu, Settings, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BookContent, Chapter, parseBook } from '@/lib/book-utils'
import { cn } from '@/lib/utils'

interface BookReaderProps {
  bookPath: string
  initialProgress?: {
    currentChart?: number
    percent?: number
  }
  onExit: () => void
  onProgressUpdate: (progress: {
    currentChart: number
    totalChars: number
    percent: number
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

  // Track reading progress for UI display
  const [progressPercent, setProgressPercent] = useState(0)

  const scrollViewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
    }
  }, [bookPath])

  // Restore initial progress
  useEffect(() => {
    if (!content || !scrollViewportRef.current) return

    // Allow a small delay for layout to settle
    const timer = setTimeout(() => {
      if (!scrollViewportRef.current) return

      if (initialProgress?.percent) {
        const targetScroll =
          (initialProgress.percent / 100) *
          scrollViewportRef.current.scrollHeight
        scrollViewportRef.current.scrollTop = targetScroll
      } else if (initialProgress?.currentChart) {
        // Fallback to line index if percent is missing
        const lineParams = document.getElementById(
          `line-${initialProgress.currentChart}`,
        )
        if (lineParams) {
          lineParams.scrollIntoView()
        }
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [content, initialProgress])

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
      const maxScroll = scrollHeight - clientHeight
      if (maxScroll <= 0) return

      const percent = (scrollTop / maxScroll) * 100
      setProgressPercent(percent)

      // Estimate current line based on percentage
      // This is rough but fast.
      const totalLines = content?.lines.length ?? 0
      const estimatedLine = Math.floor((percent / 100) * totalLines)

      onProgressUpdate({
        currentChart: estimatedLine,
        totalChars: totalLines,
        percent,
      })
    },
    [content, onProgressUpdate],
  )

  const jumpToChapter = (chapter: Chapter) => {
    setShowToc(false)
    // Try to find the element
    const element = document.getElementById(`line-${chapter.lineIndex}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      // Fallback relative scrolling
      if (content && scrollViewportRef.current) {
        const ratio = chapter.lineIndex / content.lines.length
        const target = ratio * scrollViewportRef.current.scrollHeight
        scrollViewportRef.current.scrollTo({ top: target, behavior: 'smooth' })
      }
    }
  }

  // Keyboard support for scrolling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!scrollViewportRef.current) return

      const scrollAmount = window.innerHeight * 0.8

      if (e.key === 'ArrowDown' || e.key === 'Space') {
        e.preventDefault()
        scrollViewportRef.current.scrollBy({
          top: scrollAmount,
          behavior: 'smooth',
        })
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        scrollViewportRef.current.scrollBy({
          top: -scrollAmount,
          behavior: 'smooth',
        })
      }
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
    <div className="bg-background text-foreground relative flex h-full w-full overflow-hidden">
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
                <h2 className="font-semibold">Table of Contents</h2>
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
                      className="hover:bg-accent hover:text-accent-foreground truncate rounded-md px-4 py-3 text-left text-sm transition-colors"
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

        {/* Text Scroll Area */}
        <div
          className="scrollbar-hide w-full flex-1 overflow-y-auto"
          ref={scrollViewportRef}
          onScrollCapture={handleScroll}
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-16">
            {content.lines.map((line, i) => (
              <p
                key={i}
                id={`line-${i}`}
                className={cn(
                  'text-foreground/90 mb-4 font-serif text-lg leading-relaxed break-words whitespace-pre-wrap',
                  mode === 'preview' && 'mb-2 text-base', // Smaller text in preview
                )}
              >
                {line || '\u00A0'}
              </p>
            ))}
            {/* Padding at bottom to allow scrolling last line to view */}
            <div className="h-[50vh]" />
          </div>
        </div>

        {/* Footer Progress - Only in full mode */}
        <div
          className={cn(
            'text-muted-foreground absolute bottom-0 z-10 w-full p-2 text-center text-xs backdrop-blur-sm transition-opacity',
            mode === 'preview'
              ? 'opacity-0 hover:opacity-100'
              : 'opacity-50 hover:opacity-100',
          )}
        >
          <span>{Math.round(progressPercent)}%</span>
        </div>
      </div>
    </div>
  )
}
