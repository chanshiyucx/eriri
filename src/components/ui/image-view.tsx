import { useEffect, useEffectEvent, useRef } from 'react'
import { GridItem } from '@/components/ui/grid-item'
import { TagButtons } from '@/components/ui/tag-buttons'
import { cn } from '@/lib/style'
import type { FileTags, Image } from '@/types/library'

interface ImageProps {
  comicId: string
  image: Image
  onTags: (id: string, filename: string, tags: FileTags) => Promise<void>
  onClick?: (index: number) => void
  onContextMenu?: (index: number) => void
  onVisible?: (index: number, isVisible: boolean) => void
  isSelected?: boolean
  className?: string
}

export function GridImage({
  comicId,
  image,
  onClick,
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

export function SingleImage({ comicId, image, onTags }: ImageProps) {
  const handleSetTags = (tags: FileTags) => {
    void onTags(comicId, image.filename, tags)
  }

  return (
    <figure
      className={cn(
        'group relative flex h-full w-full items-center justify-center',
        image.deleted && 'opacity-40',
      )}
    >
      <img
        key={image.url}
        src={image.url}
        alt={image.filename}
        className="block h-full w-auto object-contain select-none"
      />
      <TagButtons
        starred={image.starred}
        deleted={image.deleted}
        onStar={() => handleSetTags({ starred: !image.starred })}
        onDelete={() => handleSetTags({ deleted: !image.deleted })}
        size="md"
      />
    </figure>
  )
}

export function ScrollImage({
  comicId,
  image,
  onTags,
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
        backgroundImage: `url(${image.thumbnail})`,
      }}
    >
      <img
        src={image.url}
        alt={image.filename}
        className="h-full w-full object-contain"
        onContextMenu={(e) => {
          e.preventDefault()
          onContextMenu?.(image.index)
        }}
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
