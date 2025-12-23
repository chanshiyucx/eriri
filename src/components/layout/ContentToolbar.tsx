import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownFromLine,
  ArrowUpDown,
  ArrowUpFromLine,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  StepForward,
  Undo2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SortKey, SortOrder } from '@/hooks/useLibrarySearch'
import { cn } from '@/lib/utils'
import { Tab } from '@/store/tabs'
import { Book, Library } from '@/types/library'

interface ContentToolbarProps {
  // Navigation State
  isCollapsed: boolean
  toggleSidebar: () => void
  activeTab: Tab | null
  activeComicTab: unknown // Using specific type would be better if exported
  isReading: boolean
  handleExitReader: () => void
  handleBack: () => void

  // Library State
  isScanning: boolean
  currentLibrary: Library | null
  handleRefresh: () => void

  // Reading Actions
  handleContinueReading: () => void
  handleStartReadingBook: (book: Book) => void
  selectedBook: Book | null
  isBookLibrary: boolean

  // Search & Sort State
  isImmersive: boolean
  searchQuery: string
  setSearchQuery: (query: string) => void
  isSearchVisible: boolean
  setIsSearchVisible: (visible: boolean) => void
  sortKey: SortKey
  toggleSort: (key: SortKey) => void
  sortOrder: SortOrder
  isSortVisible: boolean
  setIsSortVisible: (visible: boolean) => void

  // Values
  readingPageIndex: number
}

export function ContentToolbar({
  isCollapsed,
  toggleSidebar,
  activeTab,
  activeComicTab,
  isReading,
  handleExitReader,
  handleBack,
  isScanning,
  currentLibrary,
  handleRefresh,
  handleContinueReading,
  handleStartReadingBook,
  selectedBook,
  isBookLibrary,
  isImmersive,
  searchQuery,
  setSearchQuery,
  isSearchVisible,
  setIsSearchVisible,
  sortKey,
  toggleSort,
  sortOrder,
  isSortVisible,
  setIsSortVisible,
  readingPageIndex,
}: ContentToolbarProps) {
  // Logic for page count display from original ContentArea
  const pageCountDisplay =
    isReading &&
    activeTab &&
    (activeTab.type === 'comic' || !activeTab.type) ? (
      <span className="text-muted-foreground mr-4 font-mono text-xs">
        {readingPageIndex + 1} / {activeTab.imageCount} (
        {Math.round((readingPageIndex / (activeTab.imageCount - 1)) * 100)}%)
      </span>
    ) : null

  return (
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
                onClick={handleRefresh}
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
                    else if (selectedBook) handleStartReadingBook(selectedBook)
                  }}
                  title="Continue Reading"
                >
                  <StepForward className="h-4 w-4" />
                </Button>
              )}

            {/* Comic Title in Detail/Reader View */}
            {activeTab && (
              <span className="ml-2 truncate text-sm font-medium">
                {activeTab.title}
              </span>
            )}
          </div>

          <div className="relative flex items-center gap-1">
            {/* Progress in Reader View */}
            {pageCountDisplay}

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

                    {/* Sort Button */}
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
                                  <span className="flex-1">按时间排序</span>
                                  <div className="flex items-center gap-1 opacity-50">
                                    {sortKey === 'date' &&
                                      (sortOrder === 'asc' ? (
                                        <ArrowDownFromLine className="h-3.5 w-3.5" />
                                      ) : (
                                        <ArrowUpFromLine className="h-3.5 w-3.5" />
                                      ))}
                                  </div>
                                </button>
                                {/* Separator */}
                                <div className="bg-border h-px w-full" />
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
  )
}
