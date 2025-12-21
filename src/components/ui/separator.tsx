import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SeparatorProps extends React.ComponentPropsWithoutRef<'div'> {
  orientation?: 'horizontal' | 'vertical'
  decorative?: boolean
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  (
    { className, orientation = 'horizontal', decorative = true, ...props },
    ref,
  ) => (
    <div // Changed from SeparatorPrimitive.Root to div to avoid installing @radix-ui/react-separator if not needed, but wait, the project has @radix-ui/react-slot.
      // Actually, I should check if I can use a simple div before introducing a new dependency.
      // The prompt said "temporarily do not need specific function logic", so I will use a simple div implementation to avoid adding dependencies unless requested.
      // I will implementation a simple version.
      className={cn(
        'bg-border shrink-0',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className,
      )}
      ref={ref}
      {...props}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={orientation}
    />
  ),
)
Separator.displayName = 'Separator' // Set display name directly

export { Separator }
