import { cn } from '@/lib/style'

type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: 'horizontal' | 'vertical'
}

export function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: SeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'bg-border shrink-0',
        className,
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
      )}
      {...props}
    />
  )
}
