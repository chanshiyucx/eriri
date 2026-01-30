import { Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/style'

interface TagButtonsProps {
  starred: boolean
  deleted: boolean
  onStar?: () => void
  onDelete?: () => void
  size?: 'sm' | 'md'
  title?: string
}

const STYLES = {
  sm: {
    btn: 'h-6 w-6',
    icon: 'h-5 w-5',
    font: 'bottom-2 text-sm',
  },
  md: {
    btn: 'h-8 w-8',
    icon: 'h-6 w-6',
    font: 'top-2 text-lg',
  },
} as const

export function TagButtons({
  title,
  starred,
  deleted,
  onStar,
  onDelete,
  size = 'sm',
}: TagButtonsProps) {
  const styles = STYLES[size]

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 isolate flex justify-between p-1',
      )}
    >
      <Button
        className={cn(styles.btn, 'bg-transparent hover:bg-transparent')}
        onClick={(e) => {
          e.stopPropagation()
          onDelete?.()
        }}
      >
        <Trash2
          className={cn(
            'stroke-white drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]',
            styles.icon,
            deleted ? 'text-subtle/40' : 'opacity-0 group-hover:opacity-100',
          )}
          strokeWidth={2.5}
        />
      </Button>
      <Button
        className={cn(styles.btn, 'bg-transparent hover:bg-transparent')}
        onClick={(e) => {
          e.stopPropagation()
          onStar?.()
        }}
      >
        <Star
          className={cn(
            'stroke-white drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]',
            styles.icon,
            starred
              ? 'fill-gold/80 stroke-love'
              : 'opacity-0 group-hover:opacity-100',
          )}
          strokeWidth={2.5}
        />
      </Button>

      {title && (
        <span
          className={cn(
            'absolute left-1/2 w-full -translate-x-1/2 truncate px-2 text-center font-bold opacity-0 text-shadow-md group-hover:opacity-100',
            styles.font,
          )}
        >
          {title}
        </span>
      )}
    </div>
  )
}
