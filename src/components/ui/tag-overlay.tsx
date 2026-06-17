import { TagButton } from '@/components/ui/tag-button'
import { TagIcon } from '@/components/ui/tag-icon'
import { cn } from '@/lib/style'

interface TagOverlayProps {
  open: boolean
  title?: string
  starred: boolean
  deleted: boolean
  onStar?: () => void
  onDelete?: () => void
  // Collapse the reveal after a tag is toggled, so the icons fall back to
  // reflecting the image's own state.
  onClose?: () => void
  // 'bar' overlays a top bar (delete | title | star) on a full-size page;
  // 'card' pins the icons to the top corners with the title as a bottom caption.
  layout: 'bar' | 'card'
}

const SIZE = {
  bar: { button: 'h-9 w-9', icon: 'h-6 w-6' },
  card: { button: 'h-7 w-7', icon: 'h-5 w-5' },
}

/**
 * Tag controls overlaid on a taggable image, shared by the grid, scroll strip
 * and preview so the appearance and reveal rules live in one place. An active
 * tag (starred/deleted) always shows its icon; `open` additionally reveals the
 * inactive icons and the title. Tapping an icon toggles that tag.
 */
export function TagOverlay({
  open,
  title,
  starred,
  deleted,
  onStar,
  onDelete,
  onClose,
  layout,
}: TagOverlayProps) {
  if (!open && !starred && !deleted) return null

  const size = SIZE[layout]
  const corner = layout === 'card'
  const toggle = (fn: () => void) => () => {
    fn()
    onClose?.()
  }

  const trash = (open || deleted) && onDelete && (
    <TagButton
      aria-label="标记删除"
      className={cn(size.button, corner ? 'absolute top-0 left-0' : 'shrink-0')}
      onClick={toggle(onDelete)}
    >
      <TagIcon kind="trash" active={deleted} className={size.icon} />
    </TagButton>
  )
  const star = (open || starred) && onStar && (
    <TagButton
      aria-label="标记收藏"
      className={cn(
        size.button,
        corner ? 'absolute top-0 right-0' : 'shrink-0',
      )}
      onClick={toggle(onStar)}
    >
      <TagIcon kind="star" active={starred} className={size.icon} />
    </TagButton>
  )

  const titleClass = 'truncate text-center font-bold text-white text-shadow-md'

  if (corner) {
    return (
      <>
        {trash}
        {star}
        {open && title && (
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 px-1 pb-1 text-xs',
              titleClass,
            )}
          >
            {title}
          </div>
        )}
      </>
    )
  }

  return (
    // pointer-events-none lets taps on the empty bar fall through to the image;
    // the buttons re-enable pointer events and swallow their own taps.
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-3 p-0.5">
      {trash}
      <span className={cn('min-w-0 flex-1', titleClass)}>{open && title}</span>
      {star}
    </div>
  )
}
