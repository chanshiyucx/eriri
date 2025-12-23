import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useComicImagePreloader } from '@/hooks/useComicImagePreloader'
import { useLibraryFiltering } from '@/hooks/useLibraryFiltering'
import { useLibrarySearch } from '@/hooks/useLibrarySearch'
import { getComicImageCount, scanBookLibrary, scanLibrary } from '@/lib/scanner'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/store/library'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import { Book, Comic } from '@/types/library'
import { BookReader } from '../reader/BookReader'
import { BookLibraryView } from './BookLibraryView'
import { ComicDetailView } from './ComicDetailView'
import { ContentToolbar } from './ContentToolbar'

interface ContentAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed?: boolean
  toggleSidebar?: () => void
}

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
    updateBookProgress,
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

  // Search & Sort state (Custom Hook)
  const {
    searchQuery,
    setSearchQuery,
    isSearchVisible,
    setIsSearchVisible,
    sortKey,
    // setSortKey,
    sortOrder,
    // setSortOrder,
    isSortVisible,
    setIsSortVisible,
    toggleSort,
  } = useLibrarySearch()

  // Book Library State
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)

  // Get active tab data
  const activeTab = getActiveTab()

  // Common comic references
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

  // Filter and Sort comics (Custom Hook)
  const processedComics = useLibraryFiltering({
    comics,
    selectedLibraryId,
    searchQuery,
    sortKey,
    sortOrder,
    showOnlyInProgress,
  })

  const currentLibrary =
    libraries.length > 0
      ? (libraries.find((l) => l.id === selectedLibraryId) ??
        libraries[libraries.length - 1])
      : null

  // Save active comic state
  useEffect(() => {
    if (!currentLibrary || currentLibrary.type === 'book') return

    // If we have an active comic tab that belongs to this library, save it
    if (activeComicTab?.type === 'comic') {
      const comic = comics.find((c) => c.id === activeComicTab.comicId)
      if (comic && comic.libraryId === currentLibrary.id) {
        setLibraryState(currentLibrary.id, {
          selectedComicId: comic.id,
        })
      }
    } else if (activeTab === null) {
      setLibraryState(currentLibrary.id, {
        selectedComicId: null,
      })
    }
  }, [currentLibrary, activeComicTab, activeTab, comics, setLibraryState])

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
    const active = getActiveTab()
    if (active?.id === `book-${book.id}`) {
      // already active
      return
    }

    addTab({
      id: `book-${book.id}`,
      type: 'book',
      bookId: book.id,
      title: book.title,
      path: book.path,
    })
  }

  const handleBack = () => {
    setActiveTab('home')
    setSidebarCollapsed(false)
  }

  return (
    <main
      className={cn('bg-surface flex h-full flex-col', className)}
      {...props}
    >
      <ContentToolbar
        isCollapsed={!!isCollapsed}
        toggleSidebar={toggleSidebar ?? (() => undefined)}
        activeTab={activeTab}
        activeComicTab={activeComicTab}
        isReading={isReading}
        handleExitReader={handleExitReader}
        handleBack={handleBack}
        isScanning={isScanning}
        currentLibrary={currentLibrary}
        handleRefresh={() => void handleRefresh()}
        handleContinueReading={handleContinueReading}
        handleStartReadingBook={handleStartReadingBook}
        selectedBook={selectedBook}
        isBookLibrary={isBookLibrary}
        isImmersive={isImmersive}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearchVisible={isSearchVisible}
        setIsSearchVisible={setIsSearchVisible}
        sortKey={sortKey}
        toggleSort={toggleSort}
        sortOrder={sortOrder}
        isSortVisible={isSortVisible}
        setIsSortVisible={setIsSortVisible}
        readingPageIndex={readingPageIndex}
      />

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout">
          {isReading && activeTab?.type !== 'book' ? (
            <motion.div
              key="reader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-50 bg-black"
            >
              <div
                className="relative flex h-full w-full cursor-pointer items-center justify-center"
                onClick={(e) => {
                  const width = e.currentTarget.clientWidth
                  const clickX = e.clientX
                  if (clickX < width * 0.3) {
                    handlePrevPage()
                  } else if (clickX > width * 0.7) {
                    handleNextPage()
                  } else {
                    toggleImmersive()
                  }
                }}
              >
                {currentImage ? (
                  <img
                    src={currentImage.url}
                    alt={currentImage.filename}
                    className="h-full w-full object-contain"
                    style={{ maxHeight: '100vh', maxWidth: '100vw' }}
                  />
                ) : (
                  <div className="text-muted-foreground flex items-center justify-center">
                    Loading...
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeTab ? (
            activeTab.type === 'book' ? (
              <motion.div
                key={activeTab.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="bg-background h-full w-full"
              >
                {activeBook ? (
                  <BookReader
                    bookPath={activeBook.path}
                    initialProgress={activeBook.progress}
                    onExit={handleExitBookReader}
                    onProgressUpdate={(p) =>
                      updateBookProgress(activeBook.id, p)
                    }
                  />
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center">
                    Book not found
                  </div>
                )}
              </motion.div>
            ) : (
              <ComicDetailView
                comicPath={activeTab.path}
                imageCount={activeTab.imageCount}
                currentProgress={activeComic?.progress?.current}
                onStartReading={handleStartReading}
              />
            )
          ) : isBookLibrary ? (
            <motion.div
              key="book-library"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="h-full w-full"
            >
              <BookLibraryView
                libraryId={currentLibrary.id}
                selectedBook={selectedBook}
                onBookSelect={handleBookSelect}
                onBookClick={handleBookClick}
              />
            </motion.div>
          ) : processedComics.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="text-muted-foreground flex h-full flex-col items-center justify-center gap-4"
            >
              <div className="text-lg">No comics found</div>
              {searchQuery && (
                <div className="text-sm">
                  Try adjusting your search or filters
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="library"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="h-full w-full"
            >
              <ScrollArea className="h-full w-full">
                <div className="flex flex-wrap justify-start gap-6 p-6 pb-4">
                  {processedComics.map((comic) => (
                    <div
                      key={comic.id}
                      className="group flex w-[128px] shrink-0 cursor-pointer flex-col gap-2"
                      onClick={() => void handleComicClick(comic)}
                    >
                      <div className="bg-muted relative aspect-[2/3] w-full overflow-hidden rounded-sm shadow-md transition-all group-hover:scale-105 group-hover:shadow-xl">
                        {comic.cover ? (
                          <img
                            src={comic.cover}
                            alt={comic.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                          />
                        ) : (
                          <div className="bg-primary/5 flex h-full w-full items-center justify-center">
                            <span className="text-primary/20 text-4xl font-bold">
                              {comic.title[0]}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <div className="text-[10px] font-medium text-white">
                            {comic.progress && comic.progress.percent > 0
                              ? `${Math.round(comic.progress.percent)}%`
                              : '0%'}
                          </div>
                          <div className="text-[10px] font-medium text-white">
                            {comic.pageCount ?? 0}P
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {comic.progress && comic.progress.percent > 0 && (
                          <div className="bg-background/30 absolute inset-x-0 bottom-0 h-1">
                            <div
                              className="bg-primary h-full transition-all duration-300"
                              style={{
                                width: `${comic.progress.percent}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <div
                        className="text-foreground/90 group-hover:text-primary truncate text-sm font-medium transition-colors"
                        title={comic.title}
                      >
                        {comic.title}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
