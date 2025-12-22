import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownFromLine,
  ArrowUpDown,
  ArrowUpFromLine,
  Check,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  StepForward,
  Undo2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useComicImagePreloader } from '@/hooks/useComicImagePreloader'
import { getComicImageCount, scanBookLibrary, scanLibrary } from '@/lib/scanner'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/store/library'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import { Book, Comic } from '@/types/library'
import { BookReader } from '../reader/BookReader'
import { BookLibraryView } from './BookLibraryView'
import { ComicDetailView } from './ComicDetailView'

interface ContentAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed?: boolean
  toggleSidebar?: () => void
}

type SortKey = 'name' | 'date'
type SortOrder = 'asc' | 'desc'

export function ContentArea({
  className,
  isCollapsed,
  toggleSidebar,
  ...props
}: ContentAreaProps) {
  const {
    comics,
    books,
    libraries,
    selectedLibraryId,
    setScanning,
    isScanning,
    replaceComicsForLibrary,
    replaceBooksForLibrary,
    updateComicProgress,
    libraryStates,
    setLibraryState,
  } = useLibraryStore()

  const {
    getActiveTab,
    addTab,
    setActiveTab,
    isImmersive,
    setImmersive,
    tabs,
    removeTab,
  } = useTabsStore()
  const { setSidebarCollapsed, showOnlyInProgress } = useUIStore()

  // Reader state
  const [isReading, setIsReading] = useState(false)
  const [readingPageIndex, setReadingPageIndex] = useState(0)

  // Search & Sort state
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [isSortVisible, setIsSortVisible] = useState(false)

  // Book Library State
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)

  // Get active tab data
  const activeTab = getActiveTab()

  // Common comic references
  // We need to check if activeTab is a comic tab
  const activeComicTab =
    activeTab && (activeTab.type === 'comic' || !activeTab.type)
      ? activeTab
      : null

  const activeComic = activeComicTab
    ? comics.find((c) => c.id === activeComicTab.comicId)
    : null

  const activeBook =
    activeTab?.type === 'book'
      ? books.find((b) => b.id === activeTab.bookId)
      : null

  // Preload images ONLY for comics, not books
  const { getCurrentImage } = useComicImagePreloader(
    activeComicTab?.path ?? '',
    readingPageIndex,
    activeComicTab?.imageCount ?? 0,
    2, // preload 2 pages before and after
  )
  // Only use preloaded image for comics in reading mode
  const currentImage =
    activeComicTab && isReading && activeTab?.type === 'comic'
      ? getCurrentImage()
      : null

  const handleStartReading = (index = 0) => {
    setReadingPageIndex(index)
    setIsReading(true)
    setSidebarCollapsed(true)
  }

  const handleContinueReading = () => {
    if (activeComic?.progress) {
      handleStartReading(activeComic.progress.current)
    } else {
      handleStartReading(0)
    }
  }

  const handleStartReadingBook = (book: Book) => {
    handleBookClick(book)
  }

  const handleNextPage = useCallback(() => {
    if (!activeComicTab) return
    if (readingPageIndex < activeComicTab.imageCount - 1) {
      const nextIndex = readingPageIndex + 1
      setReadingPageIndex(nextIndex)
      updateComicProgress(
        activeComicTab.comicId,
        nextIndex,
        activeComicTab.imageCount,
      )
    }
  }, [activeComicTab, readingPageIndex, updateComicProgress])

  const handlePrevPage = useCallback(() => {
    if (readingPageIndex > 0) {
      const prevIndex = readingPageIndex - 1
      setReadingPageIndex(prevIndex)
      updateComicProgress(
        activeComicTab!.comicId,
        prevIndex,
        activeComicTab!.imageCount,
      )
    }
  }, [activeComicTab, readingPageIndex, updateComicProgress])

  const handleExitReader = useCallback(() => {
    setIsReading(false)
    setImmersive(false)
  }, [setImmersive])

  const handleExitBookReader = useCallback(() => {
    setActiveTab('home')
    setSidebarCollapsed(false)
  }, [setActiveTab, setSidebarCollapsed])

  const handleBookSelect = (book: Book | null) => {
    setSelectedBook(book)
    // Update persistent state
    if (currentLibrary) {
      setLibraryState(currentLibrary.id, {
        selectedBookId: book?.id ?? null,
      })
    }
  }

  const toggleImmersive = useCallback(() => {
    setImmersive(!isImmersive)
  }, [isImmersive, setImmersive])

  // Keyboard navigation
  useEffect(() => {
    if (!isReading) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNextPage()
      if (e.key === 'ArrowLeft') handlePrevPage()
      if (e.key === 'Escape') handleExitReader()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isReading, handleNextPage, handlePrevPage, handleExitReader])

  // Reset reading state when switching tabs
  useEffect(() => {
    setIsReading(false)
    setImmersive(false)
  }, [activeTab?.id, setImmersive])

  // Filter and Sort comics
  const processedComics = useMemo(() => {
    let result = selectedLibraryId
      ? comics.filter((c) => c.libraryId === selectedLibraryId)
      : comics

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter((c) => c.title.toLowerCase().includes(query))
    }

    // Filter by reading progress (Continue Reading)
    if (showOnlyInProgress) {
      result = result.filter((c) => c.progress && c.progress.percent > 0)
    }

    // Ensure unique comics before sorting
    const unique = Array.from(new Map(result.map((c) => [c.id, c])).values())

    // Sort
    return unique.sort((a, b) => {
      let comparison = 0
      if (sortKey === 'name') {
        comparison = a.title.localeCompare(b.title, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      } else {
        comparison = (a.createdAt || 0) - (b.createdAt || 0)
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [
    comics,
    selectedLibraryId,
    searchQuery,
    sortKey,
    sortOrder,
    showOnlyInProgress,
  ])

  const currentLibrary =
    libraries.length > 0
      ? (libraries.find((l) => l.id === selectedLibraryId) ??
        libraries[libraries.length - 1])
      : null

  const isBookLibrary = currentLibrary?.type === 'book'

  // Restore selected book from persistent state when library changes
  useEffect(() => {
    if (currentLibrary && isBookLibrary) {
      const state = libraryStates[currentLibrary.id]
      if (state?.selectedBookId) {
        const book = books.find((b) => b.id === state.selectedBookId)
        if (book) {
          setSelectedBook(book)
          return
        }
      }
      setSelectedBook(null)
    }
  }, [currentLibrary, isBookLibrary, libraryStates, books])

  const handleRefreshLibrary = async (libraryId: string) => {
    const library = libraries.find((l) => l.id === libraryId)
    if (!library) return

    try {
      setScanning(true)

      if (library.type === 'book') {
        const { authors, books } = await scanBookLibrary(
          library.path,
          library.id,
        )

        // Replace existing authors and books for this library
        replaceBooksForLibrary(library.id, authors, books)
      } else {
        const comics = await scanLibrary(library.path, library.id)
        replaceComicsForLibrary(
          libraryId,
          comics.map((c) => ({ ...c, libraryId })),
        )
      }
      console.log('Refresh success')
    } catch (error) {
      console.error('Refresh failed', error)
      alert('Refresh failed: ' + String(error))
    } finally {
      setScanning(false)
    }
  }

  const handleRefresh = async () => {
    if (!currentLibrary) return
    await handleRefreshLibrary(currentLibrary.id)
  }

  const handleComicClick = async (comic: Comic) => {
    setScanning(true)
    try {
      // Only get the image count for lazy loading
      const imageCount = await getComicImageCount(comic.path)

      // Check for existing tab with same path and remove it
      const existingTab = tabs.find((t) => t.path === comic.path)
      if (existingTab) {
        removeTab(existingTab.id)
      }

      // Create new tab
      const tabId = `comic-${comic.id}`
      addTab({
        id: tabId,
        comicId: comic.id,
        title: comic.title,
        path: comic.path,
        imageCount,
        type: 'comic',
      })
    } catch (error) {
      console.error('Failed to load comic:', error)
      alert('Failed to load comic')
    } finally {
      setScanning(false)
    }
  }

  const handleBookClick = (book: Book) => {
    // Check for existing tab with same path and remove it
    const existingTab = tabs.find((t) => t.path === book.path)
    if (existingTab) {
      removeTab(existingTab.id)
    }

    const tabId = `book-${book.id}`

    // Create new tab
    addTab({
      id: tabId,
      bookId: book.id,
      title: book.title,
      path: book.path,
      type: 'book',
    })

    // Save selected book to persistent state
    if (currentLibrary) {
      setLibraryState(currentLibrary.id, {
        selectedBookId: book.id,
      })
    }

    setSidebarCollapsed(true)
  }

  const handleBack = () => {
    setActiveTab('home')
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  }

  const pageTransition = {
    duration: 0.2,
    ease: 'easeInOut',
  } as const

  return (
    <div
      className={cn(
        'bg-surface flex h-full flex-col transition-all duration-300',
        className,
      )}
      {...props}
    >
      {/* Toolbar */}
      <AnimatePresence>
        {!isImmersive && activeTab?.type !== 'book' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex h-10 items-center justify-between border-b px-4"
          >
            <div className="flex flex-1 items-center gap-1 overflow-hidden">
              {/* Toggle Sidebar - Always visible */}
              <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                {isCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>

              {/* Back Button - Only in detail or reader view */}
              {(activeTab ?? isReading) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={isReading ? handleExitReader : handleBack}
                  title="Back"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              )}

              {!isReading && !activeTab && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    void handleRefresh()
                  }}
                  disabled={isScanning || !currentLibrary}
                  title="Refresh"
                  className="shrink-0"
                >
                  <RefreshCw
                    className={cn('h-4 w-4', isScanning && 'animate-spin')}
                  />
                </Button>
              )}

              {/* Continue Reading Button */}
              {(Boolean(activeComicTab) ||
                Boolean(isBookLibrary && selectedBook)) &&
                !isReading && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (activeTab) handleContinueReading()
                      else if (selectedBook)
                        handleStartReadingBook(selectedBook)
                    }}
                    title="Continue Reading"
                  >
                    <StepForward className="h-4 w-4" />
                  </Button>
                )}

              {/* Comic Title in Detail/Reader View */}
              {activeTab && (
                <span className="text-foreground/90 truncate text-sm font-medium">
                  {activeTab.title}
                </span>
              )}
            </div>

            <div className="relative flex items-center gap-1">
              {/* Progress in Reader View */}
              {isReading &&
                activeTab &&
                (activeTab.type === 'comic' || !activeTab.type) && (
                  <span className="text-muted-foreground mr-4 font-mono text-xs">
                    {readingPageIndex + 1} / {activeTab.imageCount} (
                    {Math.round(
                      (readingPageIndex / (activeTab.imageCount - 1)) * 100,
                    )}
                    %)
                  </span>
                )}

              {!isReading && (
                <>
                  {!activeTab && (
                    <>
                      {!isSearchVisible && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsSearchVisible(!isSearchVisible)}
                          className={cn(searchQuery && 'text-primary')}
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Search Input - Inline expansion */}
                      <AnimatePresence>
                        {isSearchVisible && (
                          <motion.div
                            initial={{ width: 40, opacity: 0 }}
                            animate={{ width: 200, opacity: 1 }}
                            exit={{ width: 40, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className="bg-background flex items-center gap-2 overflow-hidden rounded-md px-2 py-1"
                          >
                            <Input
                              autoFocus
                              placeholder="搜索漫画..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="bg-overlay! h-6 flex-1 border-none bg-transparent p-1 text-sm shadow-none placeholder:text-base! focus-visible:ring-0"
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setIsSearchVisible(false)
                                  setSearchQuery('')
                                }
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 shrink-0 p-0 hover:bg-transparent"
                              onClick={() => {
                                setIsSearchVisible(false)
                                setSearchQuery('')
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Sort Button - valid for both comics and books now */}
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsSortVisible(!isSortVisible)}
                          className={cn(isSortVisible && 'bg-accent')}
                        >
                          <ArrowUpDown className="h-4 w-4" />
                        </Button>
                        <AnimatePresence>
                          {isSortVisible && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setIsSortVisible(false)}
                              />
                              <motion.div
                                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                className="bg-popover text-popover-foreground border-border absolute top-full right-0 z-50 mt-1 w-48 rounded-md border p-1 shadow-md"
                              >
                                <div className="space-y-1">
                                  <button
                                    className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
                                    onClick={() => {
                                      toggleSort('name')
                                    }}
                                  >
                                    <div className="w-4 shrink-0">
                                      {sortKey === 'name' && (
                                        <Check className="h-3.5 w-3.5" />
                                      )}
                                    </div>
                                    <span className="flex-1">按名称排序</span>
                                    <div className="flex items-center gap-1 opacity-50">
                                      {sortKey === 'name' &&
                                        (sortOrder === 'asc' ? (
                                          <ArrowDownFromLine className="h-3.5 w-3.5" />
                                        ) : (
                                          <ArrowUpFromLine className="h-3.5 w-3.5" />
                                        ))}
                                    </div>
                                  </button>
                                  <button
                                    className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
                                    onClick={() => {
                                      toggleSort('date')
                                    }}
                                  >
                                    <div className="w-4 shrink-0">
                                      {sortKey === 'date' && (
                                        <Check className="h-3.5 w-3.5" />
                                      )}
                                    </div>
                                    <span className="flex-1">
                                      按创建时间排序
                                    </span>
                                    <div className="flex items-center gap-1 opacity-50">
                                      {sortKey === 'date' &&
                                        (sortOrder === 'asc' ? (
                                          <ArrowDownFromLine className="h-3.5 w-3.5" />
                                        ) : (
                                          <ArrowUpFromLine className="h-3.5 w-3.5" />
                                        ))}
                                    </div>
                                  </button>
                                </div>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Book Reader - Preview mode, progress updates disabled */}
      {activeTab?.type === 'book' && (
        <BookReader
          bookPath={activeTab.path}
          initialProgress={activeBook?.progress}
          mode="preview"
          onExit={handleExitBookReader}
          onProgressUpdate={(p) => {
            // Do NOT update progress in preview mode
            // Progress should only be saved when user actually reads in full mode
            console.log('Preview mode - ignoring progress update:', p)
          }}
        />
      )}

      {/* Content Grid with Animations */}
      {activeTab?.type !== 'book' && (
        <ScrollArea className="flex-1 transition-all duration-300">
          <AnimatePresence mode="wait">
            {isReading && activeTab ? (
              /* Reader View */
              <motion.div
                key="reader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="relative flex h-full items-center justify-center"
              >
                <div
                  className="group relative h-full w-full overflow-hidden"
                  onClick={(e) => {
                    const x = e.clientX
                    const width = window.innerWidth
                    // If clicking in the middle 40% area, toggle immersive
                    if (x > width * 0.3 && x < width * 0.7) {
                      toggleImmersive()
                    } else if (x < width / 3) {
                      handlePrevPage()
                    } else {
                      handleNextPage()
                    }
                  }}
                >
                  <img
                    src={
                      currentImage?.url ??
                      activeTab.images?.[readingPageIndex]?.url ??
                      ''
                    }
                    alt={
                      currentImage?.filename ??
                      activeTab.images?.[readingPageIndex]?.filename ??
                      `Page ${readingPageIndex + 1}`
                    }
                    className="h-full w-full object-contain"
                  />

                  {/* Navigation Zones Overlay */}
                  <div className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize" />
                  <div className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize" />

                  {/* Navigation Hints */}
                  <AnimatePresence>
                    {!isImmersive && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1/2 left-4 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePrevPage()
                          }}
                          disabled={readingPageIndex === 0}
                        >
                          <ChevronLeft className="h-8 w-8" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1/2 right-4 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleNextPage()
                          }}
                          disabled={
                            readingPageIndex === activeTab.imageCount - 1
                          }
                        >
                          <ChevronLeft className="h-8 w-8 rotate-180" />
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : activeTab ? (
              /* Detail View - Virtualized for performance */
              <ComicDetailView
                comicPath={activeTab.path}
                imageCount={activeTab.imageCount}
                currentProgress={activeComic?.progress?.current}
                onStartReading={handleStartReading}
              />
            ) : /* Library View */
            isBookLibrary && currentLibrary ? (
              <motion.div
                key="book-library"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full w-full"
              >
                <BookLibraryView
                  libraryId={currentLibrary.id}
                  onBookClick={handleBookClick}
                  selectedBook={selectedBook}
                  onBookSelect={handleBookSelect}
                  searchQuery={searchQuery}
                  sortKey={sortKey}
                  sortOrder={sortOrder}
                />
              </motion.div>
            ) : processedComics.length === 0 ? (
              <motion.div
                key="empty"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                className="text-muted-foreground flex h-full flex-col items-center justify-center"
              >
                <p>{searchQuery ? '未找到匹配的漫画' : '未找到漫画'}</p>
                {!searchQuery && <p className="text-sm">点击 + 导入文件夹</p>}
                {searchQuery && (
                  <Button
                    variant="link"
                    onClick={() => {
                      setSearchQuery('')
                      setIsSearchVisible(false)
                    }}
                  >
                    清除搜索
                  </Button>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="library"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                className="grid grid-cols-[repeat(auto-fill,128px)] justify-center gap-6 pb-4 sm:justify-start"
              >
                {processedComics.map((comic) => (
                  <div
                    key={comic.id}
                    className="group flex w-[128px] cursor-pointer flex-col gap-2"
                    onClick={() => {
                      void handleComicClick(comic)
                    }}
                  >
                    {/* Cover Image Container */}
                    <div className="bg-muted relative aspect-[2/3] w-full overflow-hidden rounded-md shadow-md transition-all group-hover:shadow-lg">
                      {comic.cover ? (
                        <img
                          src={comic.cover}
                          alt={comic.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="bg-muted-foreground/10 text-muted-foreground flex h-full w-full items-center justify-center text-xs">
                          No Cover
                        </div>
                      )}

                      {/* Progress Badge */}
                      {comic.progress && comic.progress.percent > 0 && (
                        <div className="absolute inset-x-0 bottom-0 flex flex-col bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
                          <div className="flex justify-between text-[10px] font-medium text-white">
                            <span>{Math.round(comic.progress.percent)}%</span>
                            <span>{comic.progress.total}P</span>
                          </div>
                          {/* Progress Bar */}
                          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/20">
                            <div
                              className="bg-primary h-full transition-all"
                              style={{ width: `${comic.progress.percent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <h3
                      className="text-foreground/90 group-hover:text-primary line-clamp-2 text-sm leading-tight font-medium transition-colors"
                      title={comic.title}
                    >
                      {comic.title}
                    </h3>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>
      )}
    </div>
  )
}
