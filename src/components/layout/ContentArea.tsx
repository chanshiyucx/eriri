import {
  ArrowUpDown,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface ContentAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed?: boolean
  toggleSidebar?: () => void
}

export function ContentArea({
  className,
  isCollapsed,
  toggleSidebar,
  ...props
}: ContentAreaProps) {
  return (
    <div className={cn('flex h-full flex-col', className)} {...props}>
      {/* Toolbar */}
      <div className="flex h-14 items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content Grid */}
      <ScrollArea className="flex-1 p-4">
        <div className="grid grid-cols-2 gap-4 pb-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="group bg-muted relative aspect-[3/4] overflow-hidden rounded-md border"
            >
              {/* Mock Image Placeholder */}
              <div className="bg-muted-foreground/10 absolute inset-0" />
              <div className="absolute right-2 bottom-2 rounded bg-black/70 px-1 text-[10px] text-white">
                12.5%
              </div>
              <div className="absolute inset-0 flex flex-col justify-end p-2">
                <div className="bg-background/90 line-clamp-2 rounded p-2 text-xs font-medium">
                  #即落ち2コマシリーズ パラレルえち構図 【{i + 1}】
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
