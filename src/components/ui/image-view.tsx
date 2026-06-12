import { Star } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { GridItem } from '@/components/ui/grid-item'
import { TagPopover } from '@/components/ui/tag-popover'
import { usePressGestures } from '@/hooks/use-press-gestures'
import { SHORTCUTS } from '@/lib/shortcuts'
import { cn } from '@/lib/style'
import type { FileTags, Image } from '@/types/library'

// Min horizontal travel (px) for a touch drag to count as a prev/next swipe.
const SWIPE_THRESHOLD = 50

// Gold star overlaid on a starred page/cover (matches the book library's icon).
const STAR_BADGE =
  'text-love fill-gold/80 absolute top-2 right-2 h-6 w-6 drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]'

interface ImageProps {
  comicId: string
  image: Image
  onTags?: (id: string, filename: string, tags: FileTags) => Promise<void>
  onClick?: (index: number) => void
  onDoubleClick?: (index: number) => void
  isSelected?: boolean
  className?: string
  loading?: 'eager' | 'lazy'
}

export function GridImage({
  image,
  onClick,
  onDoubleClick,
  isSelected,
  className,
}: ImageProps) {
  return (
    <GridItem
      className={className}
      title={image.filename}
      cover={image.thumbnail}
      starred={image.starred}
      deleted={image.deleted}
      isSelected={isSelected}
      onClick={() => onClick?.(image.index)}
      onDoubleClick={() => onDoubleClick?.(image.index)}
    />
  )
}

export function SingleImage({
  comicId,
  image,
  onTags,
  onDoubleClick,
}: ImageProps) {
  const [tagOpen, setTagOpen] = useState(false)
  const gestures = usePressGestures({
    onTap: () => setTagOpen((v) => !v),
    onDoubleTap: () => onDoubleClick?.(image?.index ?? -1),
  })

  if (!image) return null

  const handleSetTags = (tags: FileTags) => {
    void onTags?.(comicId, image.filename, tags)
  }

  return (
    <figure
      className="flex h-full w-full touch-manipulation items-center justify-center"
      {...gestures}
    >
      <div
        className="group relative max-h-full max-w-full"
        style={{
          aspectRatio: `${image.width} / ${image.height}`,
        }}
      >
        <img
          key={image.url}
          src={image.url}
          alt={image.filename}
          decoding="async"
          className={cn('block h-full w-full', image.deleted && 'grayscale')}
        />
        {image.starred && !tagOpen && (
          <Star className={STAR_BADGE} strokeWidth={2.5} />
        )}
        <TagPopover
          open={tagOpen}
          title={image.filename}
          starred={image.starred}
          deleted={image.deleted}
          onStar={() => handleSetTags({ starred: !image.starred })}
          onDelete={() => handleSetTags({ deleted: !image.deleted })}
        />
      </div>
    </figure>
  )
}

export function ScrollImage({
  image,
  onDoubleClick,
  className = 'h-full',
  loading = 'eager',
}: ImageProps) {
  const gestures = usePressGestures({
    onDoubleTap: () => onDoubleClick?.(image.index),
  })

  return (
    <figure
      className={cn('group relative shrink-0 touch-manipulation', className)}
      style={{
        aspectRatio: `${image.width} / ${image.height}`,
      }}
      {...gestures}
    >
      <img
        src={image.url}
        alt={image.filename}
        decoding="async"
        draggable={false}
        loading={loading}
        className={cn(
          'block h-full w-full object-contain',
          image.deleted && 'grayscale',
        )}
      />
      {image.starred && <Star className={STAR_BADGE} strokeWidth={2.5} />}
    </figure>
  )
}

interface ImagePreviewProps extends Omit<ImageProps, 'image' | 'onClick'> {
  images: Image[]
  index: number
  onIndexChange: (index: number) => void
}

export function ImagePreview({
  comicId,
  images,
  index,
  onIndexChange,
  onTags,
  onDoubleClick,
}: ImagePreviewProps) {
  const currentImage = images[index]
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const goPrev = () => {
    if (index > 0) onIndexChange(index - 1)
  }
  const goNext = () => {
    if (index < images.length - 1) onIndexChange(index + 1)
  }

  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (index < 0) return

    switch (e.code) {
      case SHORTCUTS.prevImage:
        goPrev()
        break
      case SHORTCUTS.nextImage:
        goNext()
        break
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Warm the HTTP cache for the adjacent pages so left/right navigation
  // paints the next image instantly instead of fetching on keypress.
  useEffect(() => {
    if (index < 0) return
    for (const neighbor of [images[index + 1], images[index - 1]]) {
      if (!neighbor) continue
      const img = new window.Image()
      img.src = neighbor.url
    }
  }, [index, images])

  // Mobile has no arrow keys: a horizontal swipe flips pages. Ignore mostly
  // vertical drags so they don't fight the double-tap-to-close gesture.
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start) return

    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return

    if (dx < 0) goNext()
    else goPrev()
  }

  if (!currentImage) return null

  return (
    <div
      className="relative flex h-full w-full flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <SingleImage
        comicId={comicId}
        image={currentImage}
        onTags={onTags}
        onDoubleClick={onDoubleClick}
      />
    </div>
  )
}

interface ImagePreviewOverlayProps {
  comicId: string
  images: Image[]
  // Index of the previewed page; < 0 keeps the overlay hidden (but mounted).
  index: number
  onIndexChange: (index: number) => void
  // Double-tap / double-click anywhere closes the overlay.
  onClose: () => void
  onTags: (id: string, filename: string, tags: FileTags) => Promise<void>
}

export function ImagePreviewOverlay({
  comicId,
  images,
  index,
  onIndexChange,
  onClose,
  onTags,
}: ImagePreviewOverlayProps) {
  return (
    <div
      className={cn(
        'bg-base fixed inset-0 z-100 flex items-center justify-center',
        index >= 0 ? 'visible' : 'hidden',
      )}
    >
      <ImagePreview
        comicId={comicId}
        images={images}
        index={index}
        onIndexChange={onIndexChange}
        onTags={onTags}
        onDoubleClick={onClose}
      />
    </div>
  )
}
