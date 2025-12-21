import { open } from '@tauri-apps/plugin-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpDown,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
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

  const { getActiveTab, addTab, setActiveTab } = useTabsStore()

  // Get active tab data
  const activeTab = getActiveTab()

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
    duration: 0.3,
    ease: 'easeInOut',
  } as const

  return (
    <div className={cn('flex h-full flex-col', className)} {...props}>
      {/* Toolbar */}
      <div className="flex h-14 items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          {/* Toggle Sidebar - Always visible */}
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>

          {/* Back Button - Only in detail view */}
          {activeTab && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              title="Back"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

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

          {/* Comic Title in Detail View */}
          {activeTab && (
            <span className="text-foreground/90 truncate text-sm font-medium">
              {activeTab.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Content Grid with Animations */}
      <ScrollArea className="flex-1 p-6">
        <AnimatePresence mode="wait">
          {activeTab ? (
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
                <div key={index} className="group flex flex-col gap-2">
                  <div className="bg-muted relative aspect-[2/3] w-[128px] overflow-hidden rounded-md shadow-md transition-all group-hover:shadow-lg">
                    <img
                      src={image.url}
                      alt={image.filename}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
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
                      <div className="absolute right-1 bottom-1 rounded bg-black/70 px-1 py-0.5 text-[10px] text-white">
                        {Math.round(comic.progress.percent)}%
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
