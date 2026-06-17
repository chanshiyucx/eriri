import { type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { stopPointerProps } from '@/hooks/use-press-gestures'
import { cn } from '@/lib/style'

interface TagButtonProps {
  'aria-label'?: string
  className?: string
  onClick: () => void
  children: ReactNode
}

/**
 * Transparent icon button overlaid on an image to toggle a tag. It swallows the
 * pointer/click events its tap rides on so the image's own tap and double-tap
 * gestures (and select-on-click) don't also fire.
 */
export function TagButton({
  className,
  onClick,
  children,
  ...props
}: TagButtonProps) {
  return (
    <Button
      className={cn('bg-transparent hover:bg-transparent', className)}
      {...stopPointerProps}
      {...props}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {children}
    </Button>
  )
}
