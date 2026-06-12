import { Star } from 'lucide-react'
import { type MouseEvent } from 'react'
import { usePressGestures } from '@/hooks/use-press-gestures'
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
  onClick: () => void
  onDoubleClick?: () => void
  onContextMenu?: (e: MouseEvent) => void
}

export function GridItem({
  className,
  title,
  cover,
  starred,
  deleted,
  isSelected,
  progress,
  onClick,
  onDoubleClick,
  onContextMenu,
}: GridItemProps) {
  const gestures = usePressGestures({
    onDoubleTap: () => onDoubleClick?.(),
  })

  return (
    <figure
      className={cn(
        'group relative flex aspect-2/3 w-full shrink-0 cursor-pointer touch-manipulation flex-col overflow-hidden transition-all',
        isSelected &&
          'after:inset-ring-love after:pointer-events-none after:absolute after:inset-0 after:inset-ring-3',
        className,
      )}
      onClick={onClick}
      onContextMenu={onContextMenu}
      {...gestures}
    >
      <img
        src={cover}
        alt={title}
        decoding="async"
        className={cn('h-full w-full object-cover', deleted && 'grayscale')}
      />
      {starred && (
        <Star
          className="text-love fill-gold/80 absolute top-1 right-1 h-5 w-5 drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]"
          strokeWidth={2.5}
        />
      )}

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
