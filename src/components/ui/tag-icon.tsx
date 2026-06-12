import { Star, Trash2 } from 'lucide-react'
import { cn } from '@/lib/style'

const BASE = 'stroke-white drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]'

interface TagIconProps {
  kind: 'star' | 'trash'
  active: boolean
  className?: string
}

/**
 * A tag-state icon: white outline when inactive, gold-filled (star) or muted
 * (trash) when active. Shared by the grid badges and the preview tag bar so the
 * two render the same state and never drift apart.
 */
export function TagIcon({ kind, active, className }: TagIconProps) {
  if (kind === 'star') {
    return (
      <Star
        className={cn(BASE, active && 'fill-gold/80 stroke-love', className)}
        strokeWidth={2.5}
      />
    )
  }
  return (
    <Trash2
      className={cn(BASE, active && 'text-subtle/40 stroke-current', className)}
      strokeWidth={2.5}
    />
  )
}
