import { SquareMenu, Star, Trash2 } from 'lucide-react'
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import { ComicStrip, type ComicStripHandle } from '@/components/ui/comic-strip'
import { GridImage, ImagePreviewOverlay } from '@/components/ui/image-view'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useClickOutside } from '@/hooks/use-click-outside'
import { useIsPhone } from '@/hooks/use-is-phone'
import { useThrottledProgress } from '@/hooks/use-throttled-progress'
import { createComicProgress } from '@/lib/progress'
import { SHORTCUTS } from '@/lib/shortcuts'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import type { FileTags, Image } from '@/types/library'

const EMPTY_ARRAY: Image[] = []

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
  // Index of the page shown in the full-screen preview; -1 = closed.
  const [previewIndex, setPreviewIndex] = useState(-1)
  const isImmersive = useUIStore((s) => s.isImmersive)
  const isPhone = useIsPhone()
  const activeTab = useTabsStore((s) => s.activeTab)

  const updateComicTags = useLibraryStore((s) => s.updateComicTags)
  const updateComicImageTags = useLibraryStore((s) => s.updateComicImageTags)
  const getComicImages = useLibraryStore((s) => s.getComicImages)

  const comic = useLibraryStore((s) => s.comics[comicId])
  const images = useLibraryStore(
    (s) => s.comicImages[comicId]?.images ?? EMPTY_ARRAY,
  )

  const updateComicProgress = useProgressStore((s) => s.updateComicProgress)
  const progress = useProgressStore((s) => s.comics[comicId])
  const savedIndex = progress?.current ?? 0
  const [readerPosition, setReaderPosition] = useState({
    comicId,
    index: savedIndex,
  })
  const throttledUpdateProgress = useThrottledProgress(updateComicProgress)

  const currentIndex =
    readerPosition.comicId === comicId ? readerPosition.index : savedIndex
  const currentIndexRef = useRef(currentIndex)
  // Page under the cursor in scroll mode (null when not hovering any page), so
  // N/M tag the hovered page; falls back to the centered page otherwise.
  const hoveredIndexRef = useRef<number | null>(null)

  // Layout effect (not passive) + declared before the scroll-jump effect below,
  // so the ref is current when that effect reads it on comic/tab/view changes.
  useLayoutEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  const setCurrentIndex = (index: number) => {
    setReaderPosition((prev) =>
      prev.comicId === comicId && prev.index === index
        ? prev
        : { comicId, index },
    )
  }

  const jumpTo = (targetIndex?: number) => {
    if (!comic || !images.length) return

    const index = Math.max(
      0,
      Math.min(images.length - 1, targetIndex ?? currentIndexRef.current),
    )
    const newProgress = createComicProgress(index, images.length)
    setCurrentIndex(index)
    updateComicProgress(comic.id, newProgress)
    stripRef.current?.jumpTo(index)
  }

  // Gate on `comic`: a tab can mount before the catalog hydrates, where
  // getComicImages bails. Depending on comic.path retries once it's available.
  const comicPath = comic?.path
  useEffect(() => {
    if (!comicPath || images.length) return
    void getComicImages(comicId)
  }, [comicId, comicPath, images.length, getComicImages])

  useLayoutEffect(() => {
    if (!images.length) return
    stripRef.current?.jumpTo(currentIndexRef.current)
  }, [activeTab, comicId, images.length])

  const handleStripIndexChange = (index: number) => {
    if (!comic) return
    setCurrentIndex(index)
    const newProgress = createComicProgress(index, images.length)
    throttledUpdateProgress.current(comic.id, newProgress)
  }

  const handleHover = (index: number | null) => {
    hoveredIndexRef.current = index
  }

  // Target of the N/M page-tag shortcuts: the previewed page when the overlay is
  // open, else the hovered page, else the centered/current page.
  const getTagTargetImage = () => {
    if (previewIndex >= 0) return images[previewIndex]
    return images[hoveredIndexRef.current ?? currentIndex]
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
    if (previewIndex >= 0) jumpTo(previewIndex)
    setPreviewIndex(-1)
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
      case SHORTCUTS.toggleImageDeleted: {
        const targetImage = getTagTargetImage()
        if (!targetImage) return
        void updateComicImageTags(comic.id, targetImage.filename, {
          deleted: !targetImage.deleted,
        })
        break
      }
      case SHORTCUTS.toggleImageStarred: {
        const targetImage = getTagTargetImage()
        if (!targetImage) return
        void updateComicImageTags(comic.id, targetImage.filename, {
          starred: !targetImage.starred,
        })
        break
      }
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
        onSelect={jumpTo}
        onTags={updateComicImageTags}
        onClose={handleCloseToc}
      />
      <div
        className={cn(
          'bg-base text-subtle relative flex h-8 w-full items-center justify-between border-b px-3 text-xs',
          isImmersive && 'hidden',
        )}
      >
        <div className="flex gap-2">
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

        <h3
          className={cn(
            'mx-2 min-w-0 flex-1 truncate text-left',
            'md:absolute md:top-1/2 md:left-1/2 md:mx-0 md:max-w-[60%] md:flex-none md:-translate-1/2 md:text-center',
          )}
        >
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
          onHover={handleHover}
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
