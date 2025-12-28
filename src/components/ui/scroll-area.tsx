import { cn } from '@/lib/style'

type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement>

export function ScrollArea({ className, children, ...props }: ScrollAreaProps) {
  return (
    <div className={cn('relative overflow-hidden', className)} {...props}>
      <div className="scrollbar-hide h-full w-full overflow-auto">
        {children}
      </div>
    </div>
  )
}
