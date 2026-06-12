import { cn } from '@/lib/style'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export function Button({ className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'bg-base pointer-events-auto inline-flex shrink-0 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-sm text-sm whitespace-nowrap transition-all outline-none select-none',
        'hover:bg-overlay disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
