import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ask, open } from '@tauri-apps/plugin-dialog'
import {
  BookImage,
  Film,
  FolderPlus,
  LibraryBig,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'
import { CacheInfo } from '@/components/layout/cache-info'
import { ThemeSwitcher } from '@/components/layout/theme-switcher'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getCacheDir, setCacheDir } from '@/lib/scanner'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useUIStore } from '@/store/ui'
import { LibraryType, type Library } from '@/types/library'

const LibraryIcon = {
  [LibraryType.book]: LibraryBig,
  [LibraryType.video]: Film,
  [LibraryType.comic]: BookImage,
}

const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 8 } }

interface SortableLibraryItemProps {
  library: Library
  isSelected: boolean
  isScanning: boolean
  onSelect: (library: Library) => void
  onRefresh: (library: Library) => Promise<void>
  onRemove: (library: Library) => Promise<void>
}

const SortableLibraryItem = memo(function SortableLibraryItem({
  library,
  isSelected,
  isScanning,
  onSelect,
  onRefresh,
  onRemove,
}: SortableLibraryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: library.id })

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
  }

  const Icon = LibraryIcon[library.type]

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('group relative', isDragging && 'z-10 opacity-80')}
    >
      <Button
        className={cn(
          'h-10 w-full justify-start gap-2 rounded-none px-4 transition-all duration-300',
          isSelected && 'bg-overlay',
        )}
        onClick={() => onSelect(library)}
      >
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span>{library.name}</span>
      </Button>
      <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <Button
          className="text-subtle bg-overlay hover:text-love h-6 w-6"
          onClick={() => void onRefresh(library)}
          disabled={isScanning}
          title="刷新库"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          className="text-subtle bg-overlay hover:text-love h-6 w-6"
          onClick={() => void onRemove(library)}
          title="删除库"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
})

export function Sidebar() {
  const isSidebarCollapsed = useUIStore((s) => s.isSidebarCollapsed)

  const libraries = useLibraryStore((s) => s.libraries)
  const removeLibrary = useLibraryStore((s) => s.removeLibrary)
  const importLibrary = useLibraryStore((s) => s.importLibrary)
  const refreshLibrary = useLibraryStore((s) => s.refreshLibrary)
  const reorderLibrary = useLibraryStore((s) => s.reorderLibrary)
  const selectedLibraryId = useLibraryStore((s) => s.selectedLibraryId)
  const setSelectedLibraryId = useLibraryStore((s) => s.setSelectedLibraryId)
  const isScanning = useLibraryStore((s) => s.isScanning)

  const librariesList = useMemo(() => {
    return Object.values(libraries).sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    )
  }, [libraries])

  const libraryIds = useMemo(
    () => librariesList.map((lib) => lib.id),
    [librariesList],
  )

  const sensors = useSensors(useSensor(PointerSensor, POINTER_SENSOR_OPTIONS))

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = libraryIds.indexOf(active.id as string)
      const newIndex = libraryIds.indexOf(over.id as string)
      if (oldIndex === -1 || newIndex === -1) return

      const newOrder = [...libraryIds]
      newOrder.splice(oldIndex, 1)
      newOrder.splice(newIndex, 0, active.id as string)
      reorderLibrary(newOrder)
    },
    [libraryIds, reorderLibrary],
  )

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
      alert('导入库失败: ' + String(error))
    }
  }

  const handleSelect = useCallback(
    (library: Library) => {
      setSelectedLibraryId(library.id)
    },
    [setSelectedLibraryId],
  )

  const handleRefresh = useCallback(
    async (library: Library) => {
      try {
        const yes = await ask(`确认刷新库 "${library.name}"?`, {
          title: '刷新库',
          kind: 'warning',
        })
        if (!yes) return
        await refreshLibrary(library.id)
      } catch (error) {
        alert('刷新库失败: ' + String(error))
      }
    },
    [refreshLibrary],
  )

  const handleRemove = useCallback(
    async (library: Library) => {
      try {
        const yes = await ask(`确认删除库 "${library.name}"?`, {
          title: '删除库',
          kind: 'warning',
        })
        if (!yes) return
        removeLibrary(library.id)
      } catch (error) {
        alert('删除库失败: ' + String(error))
      }
    },
    [removeLibrary],
  )

  return (
    <aside
      className={cn(
        'bg-base flex h-full flex-col transition-all duration-300 ease-in-out',
        isSidebarCollapsed ? 'w-0' : 'w-56 border-r',
      )}
    >
      <ScrollArea className="flex-1">
        <Button
          className="h-10 w-full justify-start gap-2 rounded-none px-4"
          disabled={isScanning}
          onClick={() => void handleImport()}
          title="导入资源"
        >
          <FolderPlus className="h-4 w-4" />
          <span>导入资源</span>
        </Button>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={libraryIds}
            strategy={verticalListSortingStrategy}
          >
            {librariesList.map((lib) => (
              <SortableLibraryItem
                key={lib.id}
                library={lib}
                isSelected={selectedLibraryId === lib.id}
                isScanning={isScanning}
                onSelect={handleSelect}
                onRefresh={handleRefresh}
                onRemove={handleRemove}
              />
            ))}
          </SortableContext>
        </DndContext>
      </ScrollArea>

      <div className="space-y-2 p-4">
        <CacheInfo />
        <ThemeSwitcher />
      </div>
    </aside>
  )
}
