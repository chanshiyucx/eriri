import { Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/style'

interface TagPopoverProps {
  open: boolean
  title?: string
  starred: boolean
  deleted: boolean
  onStar: () => void
  onDelete: () => void
}

const ICON = 'h-6 w-6 stroke-white drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]'

/**
 * Tag bar shown over the preview image: delete (left), title (center), star
 * (right), no backdrop. A single tap on the image toggles it open/closed;
 * navigating pages keeps it open while the title/state follow the image.
 * Tapping a button toggles its tag. Pointer events are stopped so the figure's
 * tap gestures don't fire.
 */
export function TagPopover({
  open,
  title,
  starred,
  deleted,
  onStar,
  onDelete,
}: TagPopoverProps) {
  if (!open) return null

  return (
    // p-0.5 keeps the star at 8px/8px, matching STAR_BADGE so it doesn't jump.
    <div
      className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 p-0.5"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <Button
        className="h-9 w-9 shrink-0 bg-transparent hover:bg-transparent"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
      >
        <Trash2
          className={cn(ICON, deleted && 'text-subtle/40 stroke-current')}
          strokeWidth={2.5}
        />
      </Button>

      {title && (
        <span className="min-w-0 flex-1 truncate text-center font-bold text-white text-shadow-md">
          {title}
        </span>
      )}

      <Button
        className="h-9 w-9 shrink-0 bg-transparent hover:bg-transparent"
        onClick={(e) => {
          e.stopPropagation()
          onStar()
        }}
      >
        <Star
          className={cn(ICON, starred && 'fill-gold/80 stroke-love')}
          strokeWidth={2.5}
        />
      </Button>
    </div>
  )
}
