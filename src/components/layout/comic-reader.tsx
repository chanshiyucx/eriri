import { SquareMenu, Star, Trash2 } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ComicStrip, type ComicStripHandle } from '@/components/ui/comic-strip'
import { GridImage, ImagePreviewOverlay } from '@/components/ui/image-view'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useClickOutside } from '@/hooks/use-click-outside'
import { useComicReadingSession } from '@/hooks/use-comic-reading-session'
import { useIsPhone } from '@/hooks/use-is-phone'
import { SHORTCUTS } from '@/lib/shortcuts'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import type { FileTags, Image } from '@/types/library'

interface TableOfContentsProps {
  comicId: string
  images: Image[]
  currentIndex: number
  isCollapsed: boolean
  onSelect: (index: number) => void
  onTags: (id: string, filename: string, tags: FileTags) => Promise<void>
  onClose: () => void
}

function TableOfContents({
  comicId,
  images,
  currentIndex,
  isCollapsed,
  onSelect,
  onTags,
  onClose,
}: TableOfContentsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const tocRef = useRef<HTMLDivElement>(null)

  useClickOutside(tocRef, onClose, !isCollapsed)

  useEffect(() => {
    if (isCollapsed) return
    scrollRef.current
      ?.querySelector(`[data-index="${currentIndex}"]`)
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
  }, [currentIndex, isCollapsed])

  return (
    <div
      ref={tocRef}
      className={cn(
        'bg-base absolute right-0 bottom-0 left-0 z-100 border-t',
        'transition-[transform,opacity] duration-300 ease-in-out',
        isCollapsed
          ? 'translate-y-full opacity-0'
          : 'translate-y-0 opacity-100',
      )}
    >
      <ScrollArea ref={scrollRef} orientation="horizontal" className="flex">
        {images.map((img) => (
          <GridImage
            key={img.filename}
            className="w-[100px]"
            comicId={comicId}
            image={img}
            isSelected={currentIndex === img.index}
            onClick={() => {
              onSelect(img.index)
            }}
            onTags={onTags}
          />
        ))}
      </ScrollArea>
    </div>
  )
}

interface ComicReaderProps {
  comicId: string
}

export function ComicReader({ comicId }: ComicReaderProps) {
  const stripRef = useRef<ComicStripHandle>(null)
  const [isTocCollapsed, setTocCollapsed] = useState(true)
  const isImmersive = useUIStore((s) => s.isImmersive)
  const isPhone = useIsPhone()
  const activeTab = useTabsStore((s) => s.activeTab)

  const updateComicTags = useLibraryStore((s) => s.updateComicTags)
  const {
    comic,
    images,
    currentIndex,
    previewIndex,
    setPreviewIndex,
    jumpTo,
    trackStripIndex,
    setHoveredIndex,
    closePreview,
    updateComicImageTags,
    toggleTargetImageDeleted,
    toggleTargetImageStarred,
  } = useComicReadingSession({
    comicId,
    stripRef,
    stripVisible: activeTab === comicId,
    tagTargetPolicy: 'reader',
  })

  const handleStripIndexChange = (index: number) => {
    trackStripIndex(index)
  }

  const handleCloseToc = () => {
    setTocCollapsed(true)
  }

  const toggleToc = () => {
    setTocCollapsed((prev) => !prev)
  }

  // Closing the preview syncs the scroll position to whatever page the user
  // flipped to, so the strip lands where they left off.
  const handlePreviewClose = () => {
    closePreview()
  }

  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (!comic) return
    if (activeTab !== comic.id) return

    switch (e.code) {
      case SHORTCUTS.toggleToc:
        toggleToc()
        break
      case SHORTCUTS.toggleItemDeleted:
        void updateComicTags(comic.id, { deleted: !comic.deleted })
        break
      case SHORTCUTS.toggleItemStarred:
        void updateComicTags(comic.id, { starred: !comic.starred })
        break
      case SHORTCUTS.toggleImageDeleted:
        toggleTargetImageDeleted()
        break
      case SHORTCUTS.toggleImageStarred:
        toggleTargetImageStarred()
        break
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  if (!comic || !images.length) return null

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <TableOfContents
        comicId={comicId}
        images={images}
        currentIndex={currentIndex}
        isCollapsed={isTocCollapsed}
        onSelect={(index) => {
          jumpTo(index)
        }}
        onTags={updateComicImageTags}
        onClose={handleCloseToc}
      />
      <div
        className={cn(
          'bg-base text-subtle relative flex h-8 w-full items-center justify-between border-b px-3 text-xs',
          isImmersive && 'hidden',
        )}
      >
        <div className="flex shrink-0 gap-2">
          <Button
            className="hover:bg-overlay mx-1 h-6 w-6 bg-transparent"
            onClick={toggleToc}
            onMouseDown={(e) => {
              e.stopPropagation()
            }}
          >
            <SquareMenu className="h-4 w-4" />
          </Button>

          <Button
            className="h-6 w-6"
            onClick={() =>
              void updateComicTags(comic.id, { deleted: !comic.deleted })
            }
            title="标记删除"
          >
            <Trash2
              className={cn('h-4 w-4', comic.deleted && 'text-subtle/40')}
            />
          </Button>

          <Button
            className="h-6 w-6"
            onClick={() =>
              void updateComicTags(comic.id, { starred: !comic.starred })
            }
            title="标记收藏"
          >
            <Star
              className={cn(
                'h-4 w-4',
                comic.starred && 'text-love fill-gold/80',
              )}
            />
          </Button>
        </div>

        <h3 className="mx-2 min-w-0 flex-1 truncate text-left">
          {comic.title}
        </h3>

        <span className="shrink-0 whitespace-nowrap">
          {currentIndex + 1} / {images.length}
        </span>
      </div>

      <div className="bg-surface flex h-0 flex-1 items-center justify-center overflow-hidden">
        <ComicStrip
          key={comicId}
          ref={stripRef}
          className="h-full w-full"
          comicId={comicId}
          images={images}
          initialIndex={currentIndex}
          orientation={isPhone ? 'vertical' : 'horizontal'}
          onCurrentIndexChange={handleStripIndexChange}
          onHover={setHoveredIndex}
          onDoubleClick={setPreviewIndex}
          onTags={updateComicImageTags}
        />
      </div>

      <ImagePreviewOverlay
        comicId={comicId}
        images={images}
        index={previewIndex}
        onIndexChange={setPreviewIndex}
        onClose={handlePreviewClose}
        onTags={updateComicImageTags}
      />
    </div>
  )
}
