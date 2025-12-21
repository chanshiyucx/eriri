import { Clock, Heart, LayoutGrid, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed?: boolean
  toggleSidebar?: () => void
}

export function Sidebar({ className, isCollapsed }: SidebarProps) {
  return (
    <div
      className={cn(
        'bg-sidebar flex h-full flex-col border-r pb-12 transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-0 overflow-hidden border-none' : 'w-64',
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
              variant="secondary"
              isCollapsed={isCollapsed}
            />
          </div>
        </div>
      </ScrollArea>

      <div className="mt-auto flex flex-col gap-2 p-4">
        <SidebarButton icon={Settings} label="设置" isCollapsed={isCollapsed} />
      </div>
    </div>
  )
}

interface SidebarButtonProps {
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
}: SidebarButtonProps) {
  return (
    <Button
      variant={variant}
      size={isCollapsed ? 'icon' : 'default'}
      className={cn(
        'w-full transition-all duration-300',
        isCollapsed ? 'justify-center' : 'justify-start gap-2',
      )}
      title={isCollapsed ? label : undefined}
    >
      <Icon className="h-4 w-4" />
      {!isCollapsed && (
        <span className="animate-in fade-in slide-in-from-left-2 duration-300">
          {label}
        </span>
      )}
    </Button>
  )
}
