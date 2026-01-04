import { ask, open } from '@tauri-apps/plugin-dialog'
import {
  BookImage,
  Film,
  FolderPlus,
  LibraryBig,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useMemo } from 'react'
import { CacheInfo } from '@/components/layout/cache-info'
import { ThemeSwitcher } from '@/components/layout/theme-switcher'
import { Button, type ButtonProps } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getCacheDir, setCacheDir } from '@/lib/scanner'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
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
        'h-10 w-full justify-start gap-2 rounded-none px-4 transition-all duration-300',
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
  const isSidebarCollapsed = useUIStore((s) => s.isSidebarCollapsed)

  const libraries = useLibraryStore((s) => s.libraries)
  const removeLibrary = useLibraryStore((s) => s.removeLibrary)
  const importLibrary = useLibraryStore((s) => s.importLibrary)
  const refreshLibrary = useLibraryStore((s) => s.refreshLibrary)
  const selectedLibraryId = useLibraryStore((s) => s.selectedLibraryId)
  const setSelectedLibraryId = useLibraryStore((s) => s.setSelectedLibraryId)
  const isScanning = useLibraryStore((s) => s.isScanning)

  const librariesList = useMemo(() => {
    return Object.values(libraries).sort((a, b) => b.createdAt - a.createdAt)
  }, [libraries])

  const handleImport = async () => {
    try {
      const cacheDir = await getCacheDir()
      if (!cacheDir) {
        const yes = await ask(
          '未设置缩略图缓存目录，请先选择一个目录用于存储缩略图。',
          {
            title: '需要设置缓存目录',
            kind: 'info',
            okLabel: '去设置',
            cancelLabel: '取消',
          },
        )
        if (!yes) return

        const selectedCache = await open({
          directory: true,
          multiple: false,
          recursive: true,
          title: '选择缓存目录',
        })
        if (!selectedCache || typeof selectedCache !== 'string') return

        await setCacheDir(selectedCache)
      }

      const selected = await open({
        directory: true,
        multiple: false,
        recursive: true,
        title: 'Select Library Folder',
      })
      if (!selected || typeof selected !== 'string') return

      await importLibrary(selected)
    } catch (error) {
      console.error('Failed to import library:', error)
      alert('Failed to import library: ' + String(error))
    }
  }

  const handleSelect = (library: Library) => {
    setSelectedLibraryId(library.id)
  }

  const handleRefresh = async (library: Library) => {
    try {
      const yes = await ask(`确认刷新库 "${library.name}"?`, {
        title: '刷新库',
        kind: 'warning',
      })
      if (!yes) return
      await refreshLibrary(library.id)
    } catch (error) {
      console.error('Failed to refresh library:', error)
      alert('Failed to refresh library: ' + String(error))
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

  console.log('Render Sidebar: ')

  return (
    <div
      className={cn(
        'bg-base flex h-full flex-col transition-all duration-300 ease-in-out',
        isSidebarCollapsed ? 'w-0' : 'w-56 border-r',
      )}
    >
      <ScrollArea className="flex-1">
        <SidebarButton
          icon={FolderPlus}
          label="导入资源"
          disabled={isScanning}
          onClick={() => {
            void handleImport()
          }}
        />
        {librariesList.map((lib) => {
          return (
            <div key={lib.id} className="group relative">
              <SidebarButton
                icon={
                  lib.type === LibraryType.book
                    ? LibraryBig
                    : lib.type === LibraryType.video
                      ? Film
                      : BookImage
                }
                label={lib.name}
                className={cn(selectedLibraryId === lib.id && 'bg-overlay')}
                onClick={() => {
                  handleSelect(lib)
                }}
              />
              <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <Button
                  className="text-subtle bg-overlay hover:text-love h-6 w-6"
                  onClick={() => {
                    void handleRefresh(lib)
                  }}
                  disabled={isScanning}
                  title="刷新库"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  className="text-subtle bg-overlay hover:text-love h-6 w-6"
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
      </ScrollArea>

      <div className="space-y-2 p-4">
        <CacheInfo />
        <ThemeSwitcher />
      </div>
    </div>
  )
}
