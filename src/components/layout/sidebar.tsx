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
import { BookImage, LibraryBig, RefreshCw, Trash2 } from 'lucide-react'
import { ThemeSwitcher } from '@/components/layout/theme-switcher'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePanelNav } from '@/hooks/use-panel-nav'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useUIStore } from '@/store/ui'
import { LibraryType, type Library } from '@/types/library'

const LibraryIcon = {
  [LibraryType.book]: LibraryBig,
  [LibraryType.comic]: BookImage,
}

const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 8 } }

export function reorderLibraryIdsAfterDrag(
  libraryIds: string[],
  activeId: string,
  overId: string | null | undefined,
) {
  if (!overId || activeId === overId) return null

  const oldIndex = libraryIds.indexOf(activeId)
  const newIndex = libraryIds.indexOf(overId)
  if (oldIndex === -1 || newIndex === -1) return null

  const newOrder = [...libraryIds]
  newOrder.splice(oldIndex, 1)
  newOrder.splice(newIndex, 0, activeId)
  return newOrder
}

interface SortableLibraryItemProps {
  library: Library
  isSelected: boolean
  isScanning: boolean
  onSelect: (library: Library) => void
  onRefresh: (library: Library) => Promise<void>
  onRemove: (library: Library) => Promise<void>
}

function SortableLibraryItem({
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
          'h-8 w-full justify-start gap-2 rounded-none px-4 transition-all duration-300',
          isSelected && 'bg-overlay text-love',
        )}
        onClick={() => {
          onSelect(library)
        }}
      >
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab"
          onClick={(e) => {
            e.stopPropagation()
          }}
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
          aria-label={`刷新库 ${library.name}`}
          title="刷新库"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          className="text-subtle bg-overlay hover:text-love h-6 w-6"
          onClick={() => void onRemove(library)}
          aria-label={`删除库 ${library.name}`}
          title="删除库"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function Sidebar() {
  const isSidebarCollapsed = useUIStore((s) => s.isSidebarCollapsed)
  const selectedLibraryId = useUIStore((s) => s.selectedLibraryId)
  const setSelectedLibraryId = useUIStore((s) => s.setSelectedLibraryId)
  const isScanning = useUIStore((s) => s.isScanning)
  const { openMiddle } = usePanelNav()

  const libraries = useLibraryStore((s) => s.libraries)
  const removeLibrary = useLibraryStore((s) => s.removeLibrary)
  const refreshLibrary = useLibraryStore((s) => s.refreshLibrary)
  const reorderLibrary = useLibraryStore((s) => s.reorderLibrary)

  const librariesList = Object.values(libraries).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const libraryIds = librariesList.map((lib) => lib.id)

  const sensors = useSensors(useSensor(PointerSensor, POINTER_SENSOR_OPTIONS))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const newOrder = reorderLibraryIdsAfterDrag(
      libraryIds,
      active.id as string,
      over?.id as string | null | undefined,
    )
    if (newOrder) reorderLibrary(newOrder)
  }

  const handleSelect = (library: Library) => {
    setSelectedLibraryId(library.id)
    openMiddle()
  }

  const handleRefresh = async (library: Library) => {
    if (!window.confirm(`确认刷新库 "${library.name}"?`)) return
    try {
      await refreshLibrary(library.id)
    } catch (error) {
      alert('刷新库失败: ' + String(error))
    }
  }

  const handleRemove = async (library: Library) => {
    if (!window.confirm(`确认删除库 "${library.name}"?`)) return
    try {
      await removeLibrary(library.id)
    } catch (error) {
      alert('删除库失败: ' + String(error))
    }
  }

  return (
    <aside
      aria-label="库侧边栏"
      className={cn(
        'bg-base h-full w-full flex-col border-r md:w-56',
        isSidebarCollapsed ? 'hidden' : 'flex',
      )}
    >
      <ScrollArea aria-label="库列表" viewportClassName="h-0 flex-1">
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

      <div className="p-4">
        <ThemeSwitcher />
      </div>
    </aside>
  )
}
