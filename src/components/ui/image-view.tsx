import { useEffect, useRef } from 'react'
import { TagButtons } from '@/components/ui/tag-buttons'
import { cn } from '@/lib/style'
import type { FileTags, Image } from '@/types/library'

interface ImageProps {
  className?: string
  comicId: string
  image: Image
  onTags: (id: string, filename: string, tags: FileTags) => Promise<void>
  onClick?: (index: number) => void
  onContextMenu?: (index: number) => void
  onVisible?: (index: number, isVisible: boolean) => void
}

export function GridImage({
  comicId,
  image,
  onContextMenu,
  onTags,
}: ImageProps) {
  const handleSetTags = (tags: FileTags) => {
    void onTags(comicId, image.filename, tags)
  }

  return (
    <figure
      className={cn(
        'group relative flex aspect-[2/3] w-full shrink-0 cursor-pointer flex-col',
        image.deleted && 'opacity-40',
      )}
    >
      <img
        src={image.thumbnail}
        alt={image.filename}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        onContextMenu={(e) => {
          e.preventDefault()
          onContextMenu?.(image.index)
        }}
      />
      <TagButtons
        starred={image.starred}
        deleted={image.deleted}
        onStar={() => handleSetTags({ starred: !image.starred })}
        onDelete={() => handleSetTags({ deleted: !image.deleted })}
        size="sm"
      />
      <figcaption className="text-love absolute bottom-2 left-1/2 -translate-x-1/2 truncate text-center text-sm opacity-0 group-hover:opacity-100">
        {image.filename}
      </figcaption>
    </figure>
  )
}

export function SingleImage({ comicId, image, onTags }: ImageProps) {
  const handleSetTags = (tags: FileTags) => {
    void onTags(comicId, image.filename, tags)
  }

  return (
    <figure
      className={cn(
        'relative flex h-full w-full items-center justify-center',
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

  useEffect(() => {
    const el = ref.current
    if (!el || !onVisible) return

    const observer = new IntersectionObserver(
      ([entry]) => onVisible(image.index, entry.isIntersecting),
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      onVisible(image.index, false)
    }
  }, [image.index, onVisible])

  const handleSetTags = (tags: FileTags) => {
    void onTags(comicId, image.filename, tags)
  }

  return (
    <figure
      ref={ref}
      className={cn(
        'relative shrink-0 bg-cover bg-center',
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
