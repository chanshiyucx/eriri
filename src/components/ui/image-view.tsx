import { useEffect, useEffectEvent } from 'react'
import { GridItem } from '@/components/ui/grid-item'
import { TagButtons } from '@/components/ui/tag-buttons'
import { SHORTCUTS } from '@/lib/shortcuts'
import { cn } from '@/lib/style'
import type { FileTags, Image } from '@/types/library'

interface ImageProps {
  comicId: string
  image: Image
  onTags: (id: string, filename: string, tags: FileTags) => Promise<void>
  onClick?: (index: number) => void
  onDoubleClick?: (index: number) => void
  onContextMenu?: (index: number) => void
  isSelected?: boolean
  className?: string
  loading?: 'eager' | 'lazy'
  tagMode?: boolean
}

export function GridImage({
  comicId,
  image,
  onClick,
  onDoubleClick,
  onContextMenu,
  onTags,
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
      onContextMenu={() => onContextMenu?.(image.index)}
      onStar={() =>
        void onTags(comicId, image.filename, { starred: !image.starred })
      }
      onDelete={() =>
        void onTags(comicId, image.filename, { deleted: !image.deleted })
      }
    />
  )
}

export function SingleImage({
  image,
  onDoubleClick,
  onContextMenu,
}: ImageProps) {
  if (!image) return null

  return (
    <figure
      className={cn(
        'flex h-full w-full items-center justify-center',
        image.deleted && 'opacity-40',
      )}
      onDoubleClick={() => onDoubleClick?.(image.index)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(image.index)
      }}
    >
      <div
        className="max-h-full max-w-full"
        style={{
          aspectRatio: `${image.width} / ${image.height}`,
        }}
      >
        <img
          key={image.url}
          src={image.url}
          alt={image.filename}
          decoding="async"
          className="block h-full w-full"
        />
      </div>
    </figure>
  )
}

export function ScrollImage({
  comicId,
  image,
  onTags,
  onDoubleClick,
  onContextMenu,
  className = 'h-full',
  loading = 'eager',
  tagMode = false,
}: ImageProps) {
  const handleSetTags = (tags: FileTags) => {
    void onTags(comicId, image.filename, tags)
  }

  return (
    <figure
      className={cn(
        'group relative shrink-0',
        image.deleted && 'opacity-40',
        className,
      )}
      style={{
        aspectRatio: `${image.width} / ${image.height}`,
      }}
      onDoubleClick={() => onDoubleClick?.(image.index)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(image.index)
      }}
    >
      <img
        src={image.url}
        alt={image.filename}
        decoding="async"
        draggable={false}
        loading={loading}
        className="block h-full w-full object-contain"
      />
      {tagMode && (
        <TagButtons
          title={image.filename}
          starred={image.starred}
          deleted={image.deleted}
          onStar={() => handleSetTags({ starred: !image.starred })}
          onDelete={() => handleSetTags({ deleted: !image.deleted })}
          size="md"
        />
      )}
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
  onContextMenu,
}: ImagePreviewProps) {
  const currentImage = images[index]

  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (index < 0) return

    switch (e.code) {
      case SHORTCUTS.prevImage:
        if (index > 0) onIndexChange(index - 1)
        break
      case SHORTCUTS.nextImage:
        if (index < images.length - 1) onIndexChange(index + 1)
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

  if (!currentImage) return null

  return (
    <div className="relative flex h-full w-full flex-col">
      <SingleImage
        comicId={comicId}
        image={currentImage}
        onTags={onTags}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      />
    </div>
  )
}
