import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { BookContent, parseBook } from '@/lib/book-utils'
import { useLibraryStore } from '@/store/library'

const BookLine = memo(({ line, index }: { line: string; index: number }) => (
  <p
    data-index={index}
    className="text-text mx-auto w-full max-w-3xl px-8 pb-4 font-serif leading-relaxed break-words whitespace-pre-wrap"
  >
    {line || '\u00A0'}
  </p>
))
BookLine.displayName = 'BookLine'

const BookHeader = memo(() => <div className="h-16" />)
BookHeader.displayName = 'BookHeader'

const BookFooter = memo(() => <div className="h-32" />)
BookFooter.displayName = 'BookFooter'

const VIRTUOSO_COMPONENTS = {
  Header: BookHeader,
  Footer: BookFooter,
}

interface BookReaderProps {
  libraryId: string
  authorId: string
  bookId: string
}

const BookReader = memo(({ libraryId, authorId, bookId }: BookReaderProps) => {
  const count = useRef(0)
  const [content, setContent] = useState<BookContent | null>(null)
  const [currentChapterTitle, setCurrentChapterTitle] = useState<string>('')
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const restoredRef = useRef(false)

  // Explicit selectors to prevent re-renders on unrelated store changes
  const updateBookProgress = useLibraryStore((s) => s.updateBookProgress)
  const findBook = useLibraryStore((s) => s.findBook)
  const book = findBook(libraryId, authorId, bookId)
  const bookPath = book?.path
  const memoizedLines = useMemo(() => content?.lines ?? [], [content])

  useEffect(() => {
    if (!bookPath) return
    restoredRef.current = false
    let mounted = true
    const load = async () => {
      try {
        const data = await parseBook(bookPath)
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
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
        throttleTimeoutRef.current = null
      }
      if (latestProgressRef.current) {
        updateBookProgress(
          libraryId,
          authorId,
          bookId,
          latestProgressRef.current,
        )
        latestProgressRef.current = null
      }
    }
  }, [bookPath, libraryId, authorId, bookId, updateBookProgress])

  useEffect(() => {
    if (!content || !virtuosoRef.current) return
    if (restoredRef.current) return

    // Allow a small delay for Virtuoso to initialize and calculate line heights
    const timer = setTimeout(() => {
      if (!virtuosoRef.current) return

      // Read progress directly from state to avoid subscription loop
      // We only need this once for restoration
      const state = useLibraryStore.getState()
      const lib = state.libraries.find((l) => l.id === libraryId)
      const author = lib?.authors?.find((a) => a.id === authorId)
      const book = author?.books?.find((b) => b.id === bookId)
      const progress = book?.progress

      if (progress?.startCharIndex) {
        // Find line by char offset
        let targetLine = 0
        if (content.lineStartOffsets) {
          // Binary search or simple loop to find the line containing the char index
          // Simple loop is fine for now as line count isn't massive, but could be optimized
          for (let i = 0; i < content.lineStartOffsets.length; i++) {
            if (content.lineStartOffsets[i] > progress.startCharIndex) {
              targetLine = Math.max(0, i - 1)
              break
            }
            targetLine = i
          }
        }

        console.log(
          'Restoring to line:',
          targetLine,
          'from char:',
          progress.startCharIndex,
        )

        virtuosoRef.current.scrollToIndex({
          index: targetLine,
          align: 'start',
          behavior: 'auto',
        })
      } else if (progress?.percent) {
        const targetLine = Math.floor(
          (progress.percent / 100) * content.lines.length,
        )
        virtuosoRef.current.scrollToIndex({
          index: targetLine,
          align: 'start',
          behavior: 'auto',
        })
      }

      // Mark as restored after successful scroll attempt
      restoredRef.current = true
    }, 100)

    return () => clearTimeout(timer)
  }, [content, libraryId, authorId, bookId])

  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestProgressRef = useRef<{
    startCharIndex: number
    totalChars: number
    percent: number
    currentChapterTitle?: string
  } | null>(null)

  // Cleanup throttle on unmount and ensure last update is sent
  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
        throttleTimeoutRef.current = null
      }
      // If we have pending progress, flush it immediately
      if (latestProgressRef.current) {
        updateBookProgress(
          libraryId,
          authorId,
          bookId,
          latestProgressRef.current,
        )
        latestProgressRef.current = null
      }
    }
  }, [libraryId, authorId, bookId, updateBookProgress])

  const renderItem = useCallback(
    (index: number, line: string) => <BookLine index={index} line={line} />,
    [],
  )

  const handleRangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      if (!content) return

      const totalLines = content.lines.length
      // Use the top of visible range as current position for stable restoration
      const currentLine = range.startIndex
      const safeLineIndex = Math.min(Math.max(0, currentLine), totalLines - 1)
      const percent = (safeLineIndex / (totalLines - 1)) * 100

      const startCharIndex = content.lineStartOffsets[safeLineIndex] ?? 0
      const totalChars =
        content.lineStartOffsets[content.lineStartOffsets.length - 1] +
        (content.lines[content.lines.length - 1]?.length || 0)

      // Find current chapter
      const reversedChapters = [...content.chapters].reverse()
      let chapterTitle = ''
      if (reversedChapters.length > 0) {
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

      latestProgressRef.current = newProgress

      throttleTimeoutRef.current ??= setTimeout(() => {
        if (latestProgressRef.current) {
          updateBookProgress(
            libraryId,
            authorId,
            bookId,
            latestProgressRef.current,
          )
        }
        throttleTimeoutRef.current = null
      }, 300)
    },
    [
      content,
      currentChapterTitle,
      libraryId,
      authorId,
      bookId,
      updateBookProgress,
    ],
  )

  console.log('render---', count.current++, currentChapterTitle || book?.title)

  return (
    <div className="flex-1">
      <div className="flex h-full flex-1 flex-col">
        <div className="bg-base text-subtle w-full border-b px-4 py-2 text-center text-xs">
          {currentChapterTitle || book?.title}
        </div>

        <Virtuoso
          ref={virtuosoRef}
          className="h-full w-full flex-1"
          data={memoizedLines}
          totalCount={memoizedLines.length}
          rangeChanged={handleRangeChanged}
          itemContent={renderItem}
          components={VIRTUOSO_COMPONENTS}
          increaseViewportBy={{ top: 0, bottom: 400 }}
        />
      </div>
    </div>
  )
})

BookReader.displayName = 'BookReader'

export { BookReader }
