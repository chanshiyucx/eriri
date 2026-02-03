import { CircleChevronLeft, CircleChevronRight } from 'lucide-react'
import { useEffect, useEffectEvent, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { GridItem } from '@/components/ui/grid-item'
import { TagButtons } from '@/components/ui/tag-buttons'
import { cn } from '@/lib/style'
import type { FileTags, Image } from '@/types/library'

interface ImageProps {
  comicId: string
  image: Image
  onTags: (id: string, filename: string, tags: FileTags) => Promise<void>
  onClick?: (index: number) => void
  onDoubleClick?: (index: number) => void
  onContextMenu?: (index: number) => void
  onVisible?: (index: number, isVisible: boolean) => void
  isSelected?: boolean
  className?: string
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
  comicId,
  image,
  onTags,
  onDoubleClick,
  onContextMenu,
}: ImageProps) {
  if (!image) return null

  const handleSetTags = (tags: FileTags) => {
    void onTags(comicId, image.filename, tags)
  }

  return (
    <figure
      className={cn(
        'group flex h-full w-full items-center justify-center',
        image.deleted && 'opacity-40',
      )}
      onDoubleClick={() => onDoubleClick?.(image.index)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(image.index)
      }}
    >
      <div
        className="relative max-h-full max-w-full"
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
        <TagButtons
          starred={image.starred}
          deleted={image.deleted}
          onStar={() => handleSetTags({ starred: !image.starred })}
          onDelete={() => handleSetTags({ deleted: !image.deleted })}
          size="md"
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
  onVisible,
  className = 'h-full',
}: ImageProps) {
  const ref = useRef<HTMLDivElement>(null)

  const onVisibleEvent = useEffectEvent((index: number, isVisible: boolean) => {
    onVisible?.(index, isVisible)
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => onVisibleEvent(image.index, entry.isIntersecting),
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      onVisibleEvent(image.index, false)
    }
  }, [image.index])

  const handleSetTags = (tags: FileTags) => {
    void onTags(comicId, image.filename, tags)
  }

  return (
    <figure
      ref={ref}
      className={cn(
        'group relative shrink-0 bg-cover bg-center',
        image.deleted && 'opacity-40',
        className,
      )}
      style={{
        aspectRatio: `${image.width} / ${image.height}`,
        contain: 'layout style paint',
      }}
      onDoubleClick={() => onDoubleClick?.(image.index)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(image.index)
      }}
    >
      <img
        key={image.url}
        src={image.url}
        alt={image.filename}
        decoding="async"
        className="block h-full w-full"
      />
      <TagButtons
        title={image.filename}
        starred={image.starred}
        deleted={image.deleted}
        onStar={() => handleSetTags({ starred: !image.starred })}
        onDelete={() => handleSetTags({ deleted: !image.deleted })}
        size="md"
      />
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
      case 'ArrowLeft':
        if (index > 0) onIndexChange(index - 1)
        break
      case 'ArrowRight':
        if (index < images.length - 1) onIndexChange(index + 1)
        break
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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

      {index > 0 && (
        <Button
          className="hover:text-love transition-color text-subtle/60 absolute top-1/2 left-4 -translate-y-1/2 bg-transparent hover:bg-transparent"
          onClick={() => onIndexChange(index - 1)}
        >
          <CircleChevronLeft className="h-10 w-10" />
        </Button>
      )}

      {index < images.length - 1 && (
        <Button
          className="hover:text-love transition-color text-subtle/60 absolute top-1/2 right-4 -translate-y-1/2 bg-transparent hover:bg-transparent"
          onClick={() => onIndexChange(index + 1)}
        >
          <CircleChevronRight className="h-10 w-10" />
        </Button>
      )}
    </div>
  )
}
