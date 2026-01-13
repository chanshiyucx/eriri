import { forwardRef } from 'react'
import { cn } from '@/lib/style'

type ScrollOrientation = 'vertical' | 'horizontal' | 'both'

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: ScrollOrientation
}

const OVERFLOW_CLASS: Record<ScrollOrientation, string> = {
  vertical: 'overflow-y-auto overflow-x-hidden',
  horizontal: 'overflow-x-auto overflow-y-hidden',
  both: 'overflow-auto',
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, orientation = 'both', ...props }, ref) => (
    <div className={cn('relative overflow-hidden', className)}>
      <div
        ref={ref}
        className={cn(
          'scrollbar-hide h-full w-full',
          OVERFLOW_CLASS[orientation],
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  ),
)

ScrollArea.displayName = 'ScrollArea'
