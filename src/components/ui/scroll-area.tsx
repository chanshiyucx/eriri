import { forwardRef } from 'react'
import { cn } from '@/lib/style'

type ScrollOrientation = 'vertical' | 'horizontal' | 'both'

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: ScrollOrientation
  viewportClassName?: string
}

const OVERFLOW_CLASS: Record<ScrollOrientation, string> = {
  vertical: 'overflow-y-auto overflow-x-hidden',
  horizontal: 'overflow-x-auto overflow-y-hidden',
  both: 'overflow-auto',
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  function ScrollArea(
    { className, viewportClassName, children, orientation = 'both', ...props },
    ref,
  ) {
    return (
      <div className={cn('relative overflow-hidden', viewportClassName)}>
        <div
          ref={ref}
          className={cn(
            'scrollbar-hide h-full w-full',
            OVERFLOW_CLASS[orientation],
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    )
  },
)
