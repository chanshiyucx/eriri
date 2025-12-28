import { cn } from '@/lib/style'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'placeholder:text-subtle px-3 py-1 text-base text-sm outline-none',
        className,
      )}
      {...props}
    />
  )
}
