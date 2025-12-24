import { ask, open } from '@tauri-apps/plugin-dialog'
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
import { Button, type ButtonProps } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { isBookLibrary, scanBookLibrary, scanComicLibrary } from '@/lib/scanner'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/store/library'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import { LibraryType, type Library } from '@/types/library'

type SidebarButtonProps = ButtonProps & {
  icon: React.ElementType
  label: string
}

function SidebarButton({
  icon: Icon,
  label,
  className,
  ...props
}: SidebarButtonProps) {
  return (
    <Button
      className={cn(
        'h-10 w-full justify-start gap-2 p-2 transition-all duration-300',
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Button>
  )
}

export function Sidebar() {
  const { isSidebarCollapsed } = useUIStore()

  const {
    libraries,
    removeLibrary,
    selectedLibraryId,
    setSelectedLibraryId,
    addLibrary,
    setScanning,
    isScanning,
    updateLibrary,
  } = useLibraryStore()
  const { setActiveTab } = useTabsStore()

  const handleImport = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        recursive: true,
        title: 'Select Library Folder',
      })
      if (!selected || typeof selected !== 'string') return

      setScanning(true)
      const existingLibrary = libraries.find((l) => l.path === selected)
      if (existingLibrary) {
        if (existingLibrary.type === LibraryType.book) {
          const authors = await scanBookLibrary(
            existingLibrary.path,
            existingLibrary.id,
          )
          updateLibrary(existingLibrary.id, { authors })
        } else {
          const comics = await scanComicLibrary(
            existingLibrary.path,
            existingLibrary.id,
          )
          updateLibrary(existingLibrary.id, { comics })
        }
      } else {
        const libraryId = crypto.randomUUID()
        const libraryName = selected.split('/').pop() ?? 'Untitled Library'

        const isBook = await isBookLibrary(selected)
        const library: Library = {
          id: libraryId,
          name: libraryName,
          path: selected,
          type: isBook ? LibraryType.book : LibraryType.comic,
        }

        console.log('isBook--', isBook)
        if (isBook) {
          library.authors = await scanBookLibrary(selected, libraryId)
        } else {
          library.comics = await scanComicLibrary(selected, libraryId)
        }
        addLibrary(library)
      }
    } catch (error) {
      console.error('Failed to import library:', error)
      alert('Failed to import library: ' + String(error))
    } finally {
      setScanning(false)
    }
  }

  const handleSelect = (library: Library) => {
    setSelectedLibraryId(library.id)
    setActiveTab('home')
  }

  const handleRefresh = async (library: Library) => {
    const yes = await ask(`确认刷新库 "${library.name}"?`, {
      title: '刷新库',
      kind: 'warning',
    })
    if (!yes) return
    try {
      setScanning(true)
      if (library.type === LibraryType.book) {
        const authors = await scanBookLibrary(library.path, library.id)
        updateLibrary(library.id, { authors })
      } else {
        const comics = await scanComicLibrary(library.path, library.id)
        updateLibrary(library.id, { comics })
      }
    } catch (error) {
      console.error('Refresh failed', error)
      alert('Refresh failed: ' + String(error))
    } finally {
      setScanning(false)
    }
  }

  const handleRemove = async (library: Library) => {
    const yes = await ask(`确认删除库 "${library.name}"?`, {
      title: '删除库',
      kind: 'warning',
    })
    if (!yes) return
    removeLibrary(library.id)
  }

  return (
    <div
      className={cn(
        'bg-base flex h-full flex-col transition-all duration-300 ease-in-out',
        isSidebarCollapsed ? 'w-0' : 'w-56 border-r',
      )}
    >
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-4">
          <SidebarButton
            icon={Clock}
            label="最近阅读"
            onClick={() => {
              setSelectedLibraryId(null)
              setActiveTab('home')
            }}
          />
          <SidebarButton
            icon={Heart}
            label="我的收藏"
            onClick={() => {
              setSelectedLibraryId(null)
              setActiveTab('home')
            }}
          />
          <SidebarButton
            icon={FolderPlus}
            label="导入资源"
            disabled={isScanning}
            onClick={() => {
              void handleImport()
            }}
          />
          {libraries.map((lib) => {
            return (
              <div key={lib.id} className="group relative">
                <SidebarButton
                  icon={lib.type === LibraryType.book ? LibraryBig : BookImage}
                  label={lib.name}
                  className={cn(selectedLibraryId === lib.id && 'bg-overlay')}
                  onClick={() => {
                    handleSelect(lib)
                  }}
                />
                <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <Button
                    className="text-subtle bg-overlay hover:text-rose h-6 w-6"
                    onClick={() => {
                      void handleRefresh(lib)
                    }}
                    disabled={isScanning}
                    title="刷新库"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    className="text-subtle bg-overlay hover:text-rose h-6 w-6"
                    onClick={() => {
                      void handleRemove(lib)
                    }}
                    title="删除库"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      <div className="p-4">
        <SidebarButton icon={Settings} label="设置" />
      </div>
    </div>
  )
}
