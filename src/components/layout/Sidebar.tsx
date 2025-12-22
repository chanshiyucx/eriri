import {
  BookImage,
  Clock,
  Heart,
  LayoutGrid,
  LibraryBig,
  Settings,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/store/library'
import { useUIStore } from '@/store/ui'

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
  const { libraries, removeLibrary, selectedLibraryId, setSelectedLibrary } =
    useLibraryStore()
  const { showOnlyInProgress, setShowOnlyInProgress } = useUIStore()

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
              }}
            />
            <SidebarButton icon={Heart} label="我的收藏" />
            <SidebarButton
              icon={LayoutGrid}
              label="所有资源"
              variant={
                selectedLibraryId === null && !showOnlyInProgress
                  ? 'secondary'
                  : 'ghost'
              }
              onClick={() => {
                setSelectedLibrary(null)
                setShowOnlyInProgress(false)
              }}
            />
            {libraries.map((lib) => (
              <div key={lib.id} className="group relative">
                <SidebarButton
                  icon={lib.type === 'book' ? LibraryBig : BookImage}
                  label={lib.name}
                  variant={selectedLibraryId === lib.id ? 'secondary' : 'ghost'}
                  onClick={() => {
                    setSelectedLibrary(lib.id)
                    setShowOnlyInProgress(false)
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-subtle hover:text-love absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Remove library "${lib.name}"?`)) {
                      removeLibrary(lib.id)
                    }
                  }}
                  title="Remove Library"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      <div className="mt-auto flex flex-col gap-2 p-4">
        <SidebarButton icon={Settings} label="设置" />
      </div>
    </div>
  )
}
