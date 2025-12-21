import { open } from '@tauri-apps/plugin-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpDown,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { scanComicImages, scanLibrary } from '@/lib/scanner'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/store/library'
import { useTabsStore } from '@/store/tabs'
import { Comic } from '@/types/library'

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
    addLibrary,
    addComics,
    setScanning,
    isScanning,
    replaceComicsForLibrary,
    libraries,
    selectedLibraryId,
  } = useLibraryStore()

  const { getActiveTab, addTab, setActiveTab, isImmersive, setImmersive } =
    useTabsStore()
  const { updateComicProgress } = useLibraryStore()

  // Reader state
  const [isReading, setIsReading] = useState(false)
  const [readingPageIndex, setReadingPageIndex] = useState(0)

  // Get active tab data
  const activeTab = getActiveTab()

  // Common comic references
  const activeComic = activeTab
    ? comics.find((c) => c.id === activeTab.comicId)
    : null

  const handleStartReading = (index = 0) => {
    setReadingPageIndex(index)
    setIsReading(true)
  }

  const handleContinueReading = () => {
    if (activeComic?.progress) {
      handleStartReading(activeComic.progress.current)
    } else {
      handleStartReading(0)
    }
  }

  const handleNextPage = useCallback(() => {
    if (!activeTab) return
    if (readingPageIndex < activeTab.images.length - 1) {
      const nextIndex = readingPageIndex + 1
      setReadingPageIndex(nextIndex)
      updateComicProgress(activeTab.comicId, nextIndex, activeTab.images.length)
    }
  }, [activeTab, readingPageIndex, updateComicProgress])

  const handlePrevPage = useCallback(() => {
    if (readingPageIndex > 0) {
      const prevIndex = readingPageIndex - 1
      setReadingPageIndex(prevIndex)
      updateComicProgress(
        activeTab!.comicId,
        prevIndex,
        activeTab!.images.length,
      )
    }
  }, [activeTab, readingPageIndex, updateComicProgress])

  const handleExitReader = useCallback(() => {
    setIsReading(false)
    setImmersive(false)
  }, [setImmersive])

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

  // Filter comics by selected library
  const filteredComics = selectedLibraryId
    ? comics.filter((c) => c.libraryId === selectedLibraryId)
    : comics

  // Ensure unique comics
  const uniqueComics = Array.from(
    new Map(filteredComics.map((c) => [c.id, c])).values(),
  )

  const currentLibrary =
    libraries.length > 0 ? libraries[libraries.length - 1] : null

  const handleImport = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        recursive: true,
        title: 'Select Manga Library Folder',
      })

      if (selected && typeof selected === 'string') {
        const existingLibrary = libraries.find((l) => l.path === selected)

        if (existingLibrary) {
          setScanning(true)
          try {
            const newComics = await scanLibrary(
              existingLibrary.path,
              existingLibrary.id,
            )
            replaceComicsForLibrary(existingLibrary.id, newComics)
            console.log('Library re-scanned successfully')
          } catch (error) {
            console.error('Failed to re-scan library:', error)
            alert('Failed to re-scan library: ' + String(error))
          } finally {
            setScanning(false)
          }
        } else {
          setScanning(true)
          const libraryId = crypto.randomUUID()
          const libraryName = selected.split('/').pop() ?? 'Untitled Library'

          addLibrary({
            id: libraryId,
            name: libraryName,
            path: selected,
            type: 'comic',
            createdAt: Date.now(),
          })

          const newComics = await scanLibrary(selected, libraryId)
          addComics(newComics)
          setScanning(false)
        }
      }
    } catch (error) {
      console.error('Failed to import library:', error)
      setScanning(false)
    }
  }

  const handleRefresh = async () => {
    if (!currentLibrary) return

    try {
      setScanning(true)
      const newComics = await scanLibrary(
        currentLibrary.path,
        currentLibrary.id,
      )
      replaceComicsForLibrary(currentLibrary.id, newComics)
      console.log('Refresh success')
    } catch (error) {
      console.error('Refresh failed', error)
      alert('Refresh failed: ' + String(error))
    } finally {
      setScanning(false)
    }
  }

  const handleComicClick = async (comic: Comic) => {
    setScanning(true)
    try {
      const images = await scanComicImages(comic.path)

      // Create or switch to tab
      const tabId = `comic-${comic.id}`
      addTab({
        id: tabId,
        comicId: comic.id,
        title: comic.title,
        images,
      })
    } catch (error) {
      console.error('Failed to load comic images:', error)
      alert('Failed to load comic')
    } finally {
      setScanning(false)
    }
  }

  const handleBack = () => {
    setActiveTab('home')
  }

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  }

  const pageTransition = {
    duration: 0.2,
    ease: 'easeInOut',
  } as const

  return (
    <div
      className={cn(
        'flex h-full flex-col transition-all duration-300',
        className,
      )}
      {...props}
    >
      {/* Toolbar */}
      <AnimatePresence>
        {!isImmersive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex h-10 items-center justify-between overflow-hidden border-b px-4 py-2"
          >
            <div className="flex items-center gap-2">
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
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}

              {!isReading && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    void handleRefresh()
                  }}
                  disabled={isScanning || (!currentLibrary && !activeTab)}
                  title="Refresh"
                  className="shrink-0"
                >
                  <RefreshCw
                    className={cn('h-4 w-4', isScanning && 'animate-spin')}
                  />
                </Button>
              )}

              {/* Continue Reading Button */}
              {activeTab && !isReading && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleContinueReading}
                  title="Continue Reading"
                >
                  <Play className="h-4 w-4 fill-current" />
                </Button>
              )}

              {/* Comic Title in Detail/Reader View */}
              {activeTab && (
                <span className="text-foreground/90 truncate text-sm font-medium">
                  {activeTab.title}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Progress in Reader View */}
              {isReading && activeTab && (
                <span className="text-muted-foreground mr-4 font-mono text-xs">
                  {readingPageIndex + 1} / {activeTab.images.length} (
                  {Math.round(
                    (readingPageIndex / (activeTab.images.length - 1)) * 100,
                  )}
                  %)
                </span>
              )}

              {!isReading && (
                <>
                  <Button variant="ghost" size="icon">
                    <Search className="h-4 w-4" />
                  </Button>
                  {!activeTab && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        void handleImport()
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon">
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Grid with Animations */}
      <ScrollArea
        className={cn(
          'flex-1 transition-all duration-300',
          !isImmersive && !isReading && 'p-6',
          (isImmersive || isReading) && 'p-0',
        )}
      >
        <AnimatePresence mode="wait">
          {isReading && activeTab ? (
            /* Reader View */
            <motion.div
              key="reader"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
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
                  src={activeTab.images[readingPageIndex].url}
                  alt={`Page ${readingPageIndex + 1}`}
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
                          readingPageIndex === activeTab.images.length - 1
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
            /* Detail View */
            <motion.div
              key="detail"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="grid grid-cols-[repeat(auto-fill,128px)] justify-center gap-6 pb-4 sm:justify-start"
            >
              {activeTab.images.map((image, index) => (
                <div
                  key={index}
                  className="group flex cursor-pointer flex-col gap-2"
                  onClick={() => handleStartReading(index)}
                >
                  <div className="bg-muted relative aspect-[2/3] w-[128px] overflow-hidden rounded-md shadow-md transition-all group-hover:shadow-lg">
                    <img
                      src={image.url}
                      alt={image.filename}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {/* Current Page Overlay */}
                    {activeComic?.progress?.current === index && (
                      <div className="border-primary bg-primary/10 absolute inset-0 flex items-center justify-center border-2">
                        <Play className="text-primary fill-primary h-8 w-8 opacity-50" />
                      </div>
                    )}
                  </div>
                  <div
                    className="text-foreground/90 truncate text-center text-xs"
                    title={image.filename}
                  >
                    {image.filename}
                  </div>
                </div>
              ))}
            </motion.div>
          ) : /* Library View */
          uniqueComics.length === 0 ? (
            <motion.div
              key="empty"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="text-muted-foreground flex h-full flex-col items-center justify-center"
            >
              <p>No comics found.</p>
              <p className="text-sm">Click + to import a folder.</p>
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
              {uniqueComics.map((comic) => (
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
    </div>
  )
}
