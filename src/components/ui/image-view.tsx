import { memo } from 'react'
import { TagButtons } from '@/components/ui/tag-buttons'
import { cn } from '@/lib/style'
import type { FileTags, Image } from '@/types/library'

interface ImageProps {
  image: Image
  onTags: (image: Image, tags: FileTags) => void
  onClick?: (index: number) => void
  onContextMenu?: (index: number) => void
}

export const GridImage = memo(function GridImage({
  image,
  onClick,
  onTags,
}: ImageProps) {
  return (
    <div
      key={image.path}
      className={cn(
        'flex w-[128px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all',
        image.deleted && 'opacity-40',
        image.starred ? 'bg-love/50' : 'hover:bg-overlay',
      )}
      onClick={() => onClick?.(image.index)}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm transition-all">
        <img
          src={image.thumbnail}
          alt={image.filename}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <TagButtons
          starred={image.starred}
          deleted={image.deleted}
          onStar={() => void onTags(image, { starred: !image.starred })}
          onDelete={() => void onTags(image, { deleted: !image.deleted })}
          size="sm"
        />
      </div>
      <div className="truncate text-center text-sm transition-colors">
        {image.filename}
      </div>
    </div>
  )
})

export const SingleImage = memo(function SingleImage({
  image,
  onTags,
}: ImageProps) {
  return (
    <div
      key={image.path}
      className={cn(
        'relative flex h-full w-full items-center justify-center',
        image.deleted && 'opacity-40',
      )}
    >
      <figure className="relative h-full w-auto">
        <img
          key={image.url}
          src={image.url}
          alt={image.filename}
          className="block h-full w-auto object-contain select-none"
        />
        <TagButtons
          starred={image.starred}
          deleted={image.deleted}
          onStar={() => onTags(image, { starred: !image.starred })}
          onDelete={() => onTags(image, { deleted: !image.deleted })}
          size="md"
        />
      </figure>
    </div>
  )
})

export const ScrollImage = memo(function ScrollImage({
  image,
  onTags,
  onContextMenu,
}: ImageProps) {
  return (
    <div
      key={image.path}
      className={cn(
        'relative h-full shrink-0 bg-cover bg-center',
        image.deleted && 'opacity-40',
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
        onStar={() => onTags(image, { starred: !image.starred })}
        onDelete={() => onTags(image, { deleted: !image.deleted })}
        size="md"
      />
    </div>
  )
})
