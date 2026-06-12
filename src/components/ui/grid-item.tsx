import { type MouseEvent } from 'react'
import { TagOverlay } from '@/components/ui/tag-overlay'
import { useTagReveal } from '@/hooks/use-tag-reveal'
import { cn } from '@/lib/style'
import type { ComicProgress } from '@/types/library'

interface GridItemProps {
  className?: string
  title: string
  cover: string
  starred: boolean
  deleted: boolean
  isSelected?: boolean
  progress?: ComicProgress
  // When set, a tap reveals both tag buttons and the title (centred at the
  // bottom) instead of running onClick; tapping again hides them. Active tags
  // stay shown either way. Used for page thumbnails; covers/TOC select on tap.
  tagOnTap?: boolean
  onClick: () => void
  onDoubleClick?: () => void
  onContextMenu?: (e: MouseEvent) => void
  onStar?: () => void
  onDelete?: () => void
}

export function GridItem({
  className,
  title,
  cover,
  starred,
  deleted,
  isSelected,
  progress,
  tagOnTap,
  onClick,
  onDoubleClick,
  onContextMenu,
  onStar,
  onDelete,
}: GridItemProps) {
  const { ref, open, gestures, close } = useTagReveal(
    () => onDoubleClick?.(),
    tagOnTap,
  )

  return (
    <figure
      ref={ref}
      className={cn(
        'group relative flex aspect-2/3 w-full shrink-0 cursor-pointer touch-manipulation flex-col overflow-hidden transition-all',
        isSelected &&
          'after:inset-ring-love after:pointer-events-none after:absolute after:inset-0 after:inset-ring-3',
        className,
      )}
      onClick={tagOnTap ? undefined : onClick}
      onContextMenu={onContextMenu}
      {...gestures}
    >
      <img
        src={cover}
        alt={title}
        decoding="async"
        className={cn('h-full w-full object-cover', deleted && 'grayscale')}
      />
      <TagOverlay
        layout="card"
        open={open}
        title={title}
        starred={starred}
        deleted={deleted}
        onStar={onStar}
        onDelete={onDelete}
        onClose={close}
      />

      {progress && progress.total > 0 && (
        <div className="absolute inset-x-0 bottom-0 flex justify-between overflow-hidden bg-linear-to-t from-black/80 via-black/40 to-transparent p-2 text-xs text-white">
          <span>
            {progress.current + 1} / {progress.total}
          </span>
          {progress.percent > 0 && <span>{Math.round(progress.percent)}%</span>}
        </div>
      )}
    </figure>
  )
}
