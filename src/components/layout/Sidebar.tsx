import { open } from '@tauri-apps/plugin-dialog'
import {
  BookImage,
  Clock,
  FolderPlus,
  Heart,
  LibraryBig,
  RefreshCw,
  Settings,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  isBookLibrary as checkIsBookLibrary,
  scanBookLibrary,
  scanLibrary,
} from '@/lib/scanner'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/store/library'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import { type LibraryType } from '@/types/library'

interface SidebarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ElementType
  label: string
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
}

function SidebarButton({
  icon: Icon,
  label,
  variant = 'ghost',
  className,
  ...props
}: SidebarButtonProps) {
  return (
    <Button
      variant={variant}
      size="default"
      className={cn(
        'w-full justify-start gap-2 transition-all duration-300',
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </Button>
  )
}

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed?: boolean
  toggleSidebar?: () => void
}

export function Sidebar({ isCollapsed }: SidebarProps) {
  const {
    libraries,
    removeLibrary,
    selectedLibraryId,
    setSelectedLibrary,
    reconnectLibrary,
    addLibrary,
    addComics,
    addAuthors,
    addBooks,
    setScanning,
    replaceComicsForLibrary,
    replaceBooksForLibrary,
    libraryStates,
    comics,
  } = useLibraryStore()
  const { showOnlyInProgress, setShowOnlyInProgress } = useUIStore()
  const { setActiveTab, tabs, addTab } = useTabsStore()

  const handleImport = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        recursive: true,
        title: 'Select Library Folder',
      })

      if (selected && typeof selected === 'string') {
        const existingLibrary = libraries.find((l) => l.path === selected)

        if (existingLibrary) {
          // Re-scan existing
          setScanning(true)
          try {
            if (existingLibrary.type === 'book') {
              const { authors, books } = await scanBookLibrary(
                existingLibrary.path,
                existingLibrary.id,
              )
              replaceBooksForLibrary(existingLibrary.id, authors, books)
            } else {
              const newComics = await scanLibrary(
                existingLibrary.path,
                existingLibrary.id,
              )
              replaceComicsForLibrary(existingLibrary.id, newComics)
            }
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

          const isBook = await checkIsBookLibrary(selected)
          const newLibrary = {
            id: libraryId,
            name: libraryName,
            path: selected,
            type: (isBook ? 'book' : 'comic') as LibraryType,
            createdAt: Date.now(),
            isValid: true,
          }

          if (isBook) {
            const { authors, books } = await scanBookLibrary(
              selected,
              libraryId,
            )
            addLibrary(newLibrary)
            addAuthors(authors.map((a) => ({ ...a, libraryId: newLibrary.id })))
            addBooks(books.map((b) => ({ ...b, libraryId: newLibrary.id })))
          } else {
            const scannedComics = await scanLibrary(selected, libraryId)
            addLibrary(newLibrary)
            addComics(
              scannedComics.map((c) => ({ ...c, libraryId: newLibrary.id })),
            )
          }

          setScanning(false)
        }
      }
    } catch (error) {
      console.error('Failed to import library:', error)
      setScanning(false)
    }
  }

  return (
    <div
      className={cn(
        'bg-base flex h-full flex-col overflow-hidden border-r transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-0' : 'w-56',
      )}
    >
      <ScrollArea className="flex-1 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            <SidebarButton
              icon={Clock}
              label="最近阅读"
              variant={showOnlyInProgress ? 'secondary' : 'ghost'}
              onClick={() => {
                setSelectedLibrary(null)
                setShowOnlyInProgress(true)
                setActiveTab('home')
              }}
            />
            <SidebarButton icon={Heart} label="我的收藏" />
            <SidebarButton
              icon={FolderPlus}
              label="导入资源"
              onClick={() => {
                void handleImport()
              }}
            />
            {libraries.map((lib) => {
              const isInvalid = lib.isValid === false
              return (
                <div key={lib.id} className="group relative">
                  <SidebarButton
                    icon={lib.type === 'book' ? LibraryBig : BookImage}
                    label={lib.name}
                    variant={
                      selectedLibraryId === lib.id ? 'secondary' : 'ghost'
                    }
                    className={cn(
                      isInvalid && 'text-muted-foreground/50 line-through',
                    )}
                    onClick={() => {
                      if (!isInvalid) {
                        setSelectedLibrary(lib.id)
                        setShowOnlyInProgress(false)

                        // Restore state
                        const savedState = libraryStates[lib.id]
                        if (
                          savedState?.selectedComicId &&
                          lib.type !== 'book'
                        ) {
                          const comicId = savedState.selectedComicId
                          // Check if tab exists
                          const existingTab = tabs.find(
                            (t) =>
                              (t.type === 'comic' || !t.type) &&
                              t.comicId === comicId,
                          )
                          if (existingTab) {
                            setActiveTab(existingTab.id)
                          } else {
                            // Recreate tab
                            const comic = comics.find((c) => c.id === comicId)
                            if (comic) {
                              addTab({
                                id: crypto.randomUUID(),
                                title: comic.title,
                                type: 'comic',
                                comicId: comic.id,
                                path: comic.path,
                                imageCount: comic.pageCount ?? 0,
                              })
                              // addTab automatically sets it as active
                            } else {
                              setActiveTab('home')
                            }
                          }
                        } else {
                          setActiveTab('home')
                        }
                      }
                    }}
                    disabled={isInvalid}
                    title={isInvalid ? `失效: ${lib.invalidReason}` : lib.name}
                  />
                  <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {/* Reconnect button for invalid libraries */}
                    {isInvalid && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-subtle hover:text-primary h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation()
                          const run = async () => {
                            const success = await reconnectLibrary(lib.id)
                            if (success) {
                              alert('重连成功！')
                            } else {
                              alert(`重连失败: ${lib.invalidReason}`)
                            }
                          }
                          void run()
                        }}
                        title="重新连接"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {/* Delete button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-subtle hover:text-love h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`删除库 "${lib.name}"?`)) {
                          removeLibrary(lib.id)
                        }
                      }}
                      title="删除库"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </ScrollArea>

      <div className="mt-auto flex flex-col gap-2 p-4">
        <SidebarButton icon={Settings} label="设置" />
      </div>
    </div>
  )
}
