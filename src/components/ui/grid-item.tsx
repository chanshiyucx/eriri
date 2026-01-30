import { TagButtons } from '@/components/ui/tag-buttons'
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
  onContextMenu: () => void
  onStar: () => void
  onDelete: () => void
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
  onStar,
  onDelete,
}: GridItemProps) {
  return (
    <figure
      className={cn(
        'group relative flex aspect-[2/3] w-full shrink-0 cursor-pointer flex-col overflow-hidden transition-all',
        deleted && 'opacity-40',
        isSelected &&
          'after:inset-ring-love after:pointer-events-none after:absolute after:inset-0 after:inset-ring-3',
        className,
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <img
        src={cover}
        alt={title}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
      <TagButtons
        title={title}
        starred={!!starred}
        deleted={!!deleted}
        onStar={onStar}
        onDelete={onDelete}
        size="sm"
      />

      {progress && progress.total > 0 && (
        <div className="absolute inset-x-0 bottom-0 flex justify-between overflow-hidden bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-xs text-white group-hover:opacity-0">
          <span>
            {progress.current + 1} / {progress.total}
          </span>
          {progress.percent > 0 && <span>{Math.round(progress.percent)}%</span>}
        </div>
      )}
    </figure>
  )
}
