import { Home, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type TopNavProps = React.HTMLAttributes<HTMLDivElement>

export function TopNav({ className, ...props }: TopNavProps) {
  return (
    <div
      className={cn(
        'bg-background flex h-10 items-center border-b px-2',
        className,
      )}
      {...props}
    >
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
        <Home className="h-4 w-4" />
        <span className="sr-only">Home</span>
      </Button>
      <Separator orientation="vertical" className="mx-2 h-6" />
      <ScrollArea className="flex-1">
        <div className="flex items-center gap-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'bg-background hover:bg-muted/50 group flex max-w-[200px] min-w-[150px] cursor-pointer items-center gap-2 rounded-md border px-3 py-1 text-sm',
                i === 0 && 'bg-muted',
              )}
            >
              <span className="flex-1 truncate">#即落ち2コマシリーズ...</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
