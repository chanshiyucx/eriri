import { cn } from '@/lib/utils'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export function Button({ className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'bg-surface inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm text-sm whitespace-nowrap transition-all outline-none',
        'hover:bg-base disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
