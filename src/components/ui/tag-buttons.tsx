import { Star, Trash2 } from 'lucide-react'
import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/style'

interface TagButtonsProps {
  starred: boolean
  deleted: boolean
  onStar?: (e: React.MouseEvent) => void
  onDelete?: (e: React.MouseEvent) => void
  size?: 'sm' | 'md'
}

export const TagButtons = memo(function TagButtons({
  starred,
  deleted,
  onStar = () => void 0,
  onDelete = () => void 0,
  size = 'sm',
}: TagButtonsProps) {
  const btnSize = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
  const iconSize = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'

  return (
    <div
      className={cn(
        'group absolute top-0 right-0 left-0 flex justify-between p-2',
      )}
    >
      <Button
        className={cn(btnSize, 'bg-transparent hover:bg-transparent')}
        onClick={onStar}
      >
        <Star
          className={cn(
            'text-love',
            iconSize,
            starred ? 'fill-gold/80' : 'opacity-0 group-hover:opacity-100',
          )}
        />
      </Button>
      <Button
        className={cn(btnSize, 'bg-transparent hover:bg-transparent')}
        onClick={onDelete}
      >
        <Trash2
          className={cn(
            'text-love',
            iconSize,
            deleted ? 'fill-gold/80' : 'opacity-0 group-hover:opacity-100',
          )}
        />
      </Button>
    </div>
  )
})
