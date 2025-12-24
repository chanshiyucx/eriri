import { PanelLeftClose, PanelLeftOpen, StepForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/ui'

export function ContentToolbar() {
  const { isSidebarCollapsed, toggleSidebar } = useUIStore()

  const handleContinueReading = () => {
    console.log('handleContinueReading')
  }

  // -- Actions --

  // const handleExitReader = () => {
  //   if (activeTab) {
  //     updateTabState(activeTab.id, { mode: 'detail' })
  //   }
  //   setImmersive(false)
  // }

  // const handleStartReading = (index = 0) => {
  //   if (activeTab) {
  //     updateTabState(activeTab.id, { mode: 'read', readingPageIndex: index })
  //     setImmersive(true)
  //     useUIStore.getState().setSidebarCollapsed(true)
  //   }
  // }

  // const handleContinueReading = () => {
  //   if (activeComic?.progress) {
  //     handleStartReading(activeComic.progress.current)
  //   } else {
  //     handleStartReading(0)
  //   }
  // }

  // const handleStartReadingBook = (book: Book) => {
  //   // Logic from ContentArea
  //   addTab({
  //     id: `book-${book.id}`,
  //     type: 'book',
  //     bookId: book.id,
  //     title: book.title,
  //     path: book.path,
  //   })
  // }

  // // Page Count Display
  // const readingPageIndex = activeTab?.readingPageIndex ?? 0
  // const pageCountDisplay =
  //   isReading &&
  //   activeTab &&
  //   (activeTab.type === 'comic' || !activeTab.type) ? (
  //     <span className="text-muted-foreground mr-4 font-mono text-xs">
  //       {readingPageIndex + 1} / {activeTab.imageCount ?? '?'} (
  //       {Math.round(
  //         (readingPageIndex / ((activeTab.imageCount ?? 1) - 1)) * 100,
  //       )}
  //       %)
  //     </span>
  //   ) : null

  return (
    <div className="flex h-10 w-full items-center justify-between border-b px-2">
      <div className="flex flex-1 items-center gap-1 overflow-hidden">
        <Button className="bg-surface h-8 w-8" onClick={toggleSidebar}>
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>

        {/* {(activeTab ?? isReading) && (
          <Button
            className="bg-surface h-8 w-8"
            onClick={isReading ? handleExitReader : handleBack}
            title="Back"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        )} */}

        <Button
          className="bg-surface h-8 w-8"
          onClick={() => handleContinueReading()}
          title="Continue Reading"
        >
          <StepForward className="h-4 w-4" />
        </Button>
        {/* 
        {activeTab && (
          <span className="ml-2 truncate text-sm font-medium">
            {activeTab.title}
          </span>
        )} */}
      </div>

      {/* <div className="relative flex items-center gap-1">
        {pageCountDisplay}

        {!isReading && (
          <>
            {!activeTab && (
              <>
                {!isSearchVisible && (
                  <Button
                    onClick={() => setIsSearchVisible(!isSearchVisible)}
                    className={cn(searchQuery && 'text-primary')}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                )}

                <AnimatePresence>
                  {isSearchVisible && (
                    <motion.div
                      initial={{ width: 40, opacity: 0 }}
                      animate={{ width: 200, opacity: 1 }}
                      exit={{ width: 40, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="bg-background flex items-center gap-2 overflow-hidden rounded-sm px-2 py-1"
                    >
                      <Input
                        autoFocus
                        placeholder="搜索漫画..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-6 w-20"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setIsSearchVisible(false)
                            setSearchQuery('')
                          }
                        }}
                      />
                      <Button
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

                <div className="relative">
                  <Button
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
                          className="bg-popover text-popover-foreground border-border absolute top-full right-0 z-50 mt-1 w-48 rounded-sm border p-1 shadow-md"
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
      </div> */}
    </div>
  )
}
