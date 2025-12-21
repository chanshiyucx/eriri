import {
  Clock,
  Heart,
  LayoutGrid,
  Library as LibraryIcon,
  Settings,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/store/library'

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed?: boolean
  toggleSidebar?: () => void
}

export function Sidebar({ className, isCollapsed }: SidebarProps) {
  const { libraries, removeLibrary, selectedLibraryId, setSelectedLibrary } =
    useLibraryStore()

  return (
    <div
      className={cn(
        'bg-sidebar flex h-full flex-col border-r pb-12 transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-0 overflow-hidden border-none' : 'w-56',
        className,
      )}
    >
      <ScrollArea className="flex-1 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            <SidebarButton
              icon={Clock}
              label="继续阅读"
              isCollapsed={isCollapsed}
            />
            <SidebarButton
              icon={Heart}
              label="我的收藏"
              isCollapsed={isCollapsed}
            />
            <SidebarButton
              icon={LayoutGrid}
              label="所有资源"
              variant={selectedLibraryId === null ? 'secondary' : 'ghost'}
              isCollapsed={isCollapsed}
              onClick={() => setSelectedLibrary(null)}
            />
            {libraries.map((lib) => (
              <div key={lib.id} className="group relative">
                <SidebarButton
                  icon={LibraryIcon}
                  label={lib.name}
                  variant={selectedLibraryId === lib.id ? 'secondary' : 'ghost'}
                  isCollapsed={isCollapsed}
                  className="pl-8"
                  onClick={() => setSelectedLibrary(lib.id)}
                />
                {!isCollapsed && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-foreground/60 hover:text-destructive absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
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
                )}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      <div className="mt-auto flex flex-col gap-2 p-4">
        <SidebarButton icon={Settings} label="设置" isCollapsed={isCollapsed} />
      </div>
    </div>
  )
}

interface SidebarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ElementType
  label: string
  isCollapsed?: boolean
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
  isCollapsed,
  variant = 'ghost',
  className,
  ...props
}: SidebarButtonProps) {
  return (
    <Button
      variant={variant}
      size={isCollapsed ? 'icon' : 'default'}
      className={cn(
        'w-full transition-all duration-300',
        isCollapsed ? 'justify-center' : 'justify-start gap-2',
        className,
      )}
      title={isCollapsed ? label : undefined}
      {...props}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!isCollapsed && (
        <span className="animate-in fade-in slide-in-from-left-2 truncate duration-300">
          {label}
        </span>
      )}
    </Button>
  )
}
