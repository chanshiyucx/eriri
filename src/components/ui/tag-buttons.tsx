import { Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsPhone } from '@/hooks/use-is-phone'
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
    padding: 'p-1',
    btn: 'h-6 w-6',
    icon: 'h-5 w-5',
    font: 'bottom-2 text-sm',
  },
  md: {
    padding: 'p-2',
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
  // Phones have no hover, so reveal the controls permanently; on pointer
  // devices keep the hover-to-reveal behavior.
  const isPhone = useIsPhone()
  const reveal = isPhone ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 isolate flex justify-between',
        styles.padding,
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
            deleted ? 'text-subtle/40' : reveal,
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
            starred ? 'fill-gold/80 stroke-love' : reveal,
          )}
          strokeWidth={2.5}
        />
      </Button>

      {title && (
        <span
          className={cn(
            'absolute left-1/2 w-full -translate-x-1/2 truncate px-2 text-center font-bold text-white text-shadow-md',
            reveal,
            styles.font,
          )}
        >
          {title}
        </span>
      )}
    </div>
  )
}
