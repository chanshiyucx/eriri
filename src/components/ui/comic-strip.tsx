import { forwardRef, memo, useImperativeHandle } from 'react'
import { ScrollImage } from '@/components/ui/image-view'
import {
  useComicStrip,
  type ComicStripOrientation,
} from '@/hooks/use-comic-strip'
import { cn } from '@/lib/style'
import type { FileTags, Image } from '@/types/library'

export interface ComicStripHandle {
  jumpTo: (index?: number) => void
}

interface ComicStripProps {
  comicId: string
  images: Image[]
  initialIndex?: number
  orientation?: ComicStripOrientation
  overscanViewports?: number
  maxRenderedPages?: number
  className?: string
  onCurrentIndexChange?: (index: number) => void
  onDoubleClick?: (index: number) => void
  onContextMenu?: (index: number) => void
  onTags: (id: string, filename: string, tags: FileTags) => Promise<void>
}

interface StripPageProps {
  comicId: string
  image: Image
  orientation: ComicStripOrientation
  start: number
  width: number
  height: number
  onDoubleClick?: (index: number) => void
  onContextMenu?: (index: number) => void
  onTags: (id: string, filename: string, tags: FileTags) => Promise<void>
}

const StripPage = memo(function StripPage({
  comicId,
  image,
  orientation,
  start,
  width,
  height,
  onDoubleClick,
  onContextMenu,
  onTags,
}: StripPageProps) {
  return (
    <div
      className={cn(
        'absolute',
        orientation === 'horizontal' ? 'top-0 h-full' : 'left-0 w-full',
      )}
      style={{
        left: orientation === 'horizontal' ? start : 0,
        top: orientation === 'vertical' ? start : 0,
        width,
        height,
      }}
    >
      <ScrollImage
        comicId={comicId}
        image={image}
        className="h-full w-full"
        loading="eager"
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onTags={onTags}
      />
    </div>
  )
})

export const ComicStrip = forwardRef<ComicStripHandle, ComicStripProps>(
  function ComicStrip(
    {
      comicId,
      images,
      initialIndex = 0,
      orientation = 'horizontal',
      overscanViewports,
      maxRenderedPages,
      className,
      onCurrentIndexChange,
      onDoubleClick,
      onContextMenu,
      onTags,
    },
    ref,
  ) {
    const { containerRef, jumpTo, layout, onScroll, visibleRange } =
      useComicStrip({
        images,
        initialIndex,
        orientation,
        overscanViewports,
        maxRenderedPages,
        onCurrentIndexChange,
      })

    useImperativeHandle(ref, () => ({ jumpTo }), [jumpTo])

    return (
      <div
        ref={containerRef}
        className={cn(
          'scrollbar-hide min-h-0 min-w-0',
          orientation === 'horizontal'
            ? 'overflow-x-auto overflow-y-hidden'
            : 'overflow-x-hidden overflow-y-auto',
          className,
        )}
        onScroll={onScroll}
      >
        <div
          className="relative"
          style={
            layout
              ? orientation === 'horizontal'
                ? { width: layout.totalSize, height: '100%' }
                : { width: '100%', height: layout.totalSize }
              : undefined
          }
        >
          {layout &&
            images
              .slice(visibleRange.start, visibleRange.end + 1)
              .map((image, offset) => {
                const page = layout.pages[visibleRange.start + offset]
                if (!page) return null

                return (
                  <StripPage
                    key={image.filename}
                    comicId={comicId}
                    image={image}
                    orientation={orientation}
                    start={page.start}
                    width={page.width}
                    height={page.height}
                    onDoubleClick={onDoubleClick}
                    onContextMenu={onContextMenu}
                    onTags={onTags}
                  />
                )
              })}
        </div>
      </div>
    )
  },
)
