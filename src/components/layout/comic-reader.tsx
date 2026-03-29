import { Columns2, Square, SquareMenu, Star, Trash2 } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import { ComicStrip, type ComicStripHandle } from '@/components/ui/comic-strip'
import { GridImage, ImagePreview } from '@/components/ui/image-view'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useClickOutside } from '@/hooks/use-click-outside'
import { useThrottledProgress } from '@/hooks/use-throttled-progress'
import { createComicProgress } from '@/lib/progress'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import type { FileTags, Image } from '@/types/library'

type ViewMode = 'single' | 'scroll'

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
            onClick={() => onSelect(img.index)}
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
  const [viewMode, setViewMode] = useState<ViewMode>('scroll')
  const isImmersive = useUIStore((s) => s.isImmersive)
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
  // eslint-disable-next-line react-hooks/refs
  currentIndexRef.current = currentIndex

  const setCurrentIndex = useCallback(
    (index: number) => {
      setReaderPosition((prev) =>
        prev.comicId === comicId && prev.index === index
          ? prev
          : { comicId, index },
      )
    },
    [comicId],
  )

  const jumpTo = useCallback(
    (targetIndex?: number) => {
      if (!comic || !images.length) return

      const index = Math.max(
        0,
        Math.min(images.length - 1, targetIndex ?? currentIndexRef.current),
      )
      const newProgress = createComicProgress(index, images.length)
      setCurrentIndex(index)
      updateComicProgress(comic.id, newProgress)

      if (viewMode === 'scroll') {
        stripRef.current?.jumpTo(index)
      }
    },
    [comic, images.length, setCurrentIndex, updateComicProgress, viewMode],
  )

  useEffect(() => {
    if (images.length) return
    void getComicImages(comicId)
  }, [comicId, images.length, getComicImages])

  useLayoutEffect(() => {
    if (viewMode !== 'scroll' || !images.length) return
    stripRef.current?.jumpTo(currentIndexRef.current)
  }, [activeTab, comicId, images.length, viewMode])

  const handleStripIndexChange = useCallback(
    (index: number) => {
      setCurrentIndex(index)
      const newProgress = createComicProgress(index, images.length)
      throttledUpdateProgress.current(comic.id, newProgress)
    },
    [comic, images.length, setCurrentIndex, throttledUpdateProgress],
  )

  const handleCloseToc = () => {
    setTocCollapsed(true)
  }

  const toggleToc = () => {
    setTocCollapsed((prev) => !prev)
  }

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === 'single' ? 'scroll' : 'single'))
  }

  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (!comic) return
    if (activeTab !== comic.id) return

    switch (e.code) {
      case 'KeyB':
        toggleViewMode()
        break
      case 'KeyT':
        toggleToc()
        break
      case 'KeyC':
        void updateComicTags(comic.id, { deleted: !comic.deleted })
        break
      case 'KeyV':
        void updateComicTags(comic.id, { starred: !comic.starred })
        break
      case 'KeyN': {
        const currentImage = images[currentIndex]
        void updateComicImageTags(comic.id, currentImage.filename, {
          deleted: !currentImage.deleted,
        })
        break
      }
      case 'KeyM': {
        const currentImage = images[currentIndex]
        void updateComicImageTags(comic.id, currentImage.filename, {
          starred: !currentImage.starred,
        })
        break
      }
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const currentImage = images[currentIndex]

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
            onMouseDown={(e) => e.stopPropagation()}
          >
            <SquareMenu className="h-4 w-4" />
          </Button>

          <Button
            className="hover:bg-overlay mx-1 h-6 w-6 bg-transparent"
            onClick={toggleViewMode}
            title={`切换到 ${viewMode === 'single' ? '滚动' : '单页'}`}
          >
            {viewMode === 'single' ? (
              <Square className="h-4 w-4" />
            ) : (
              <Columns2 className="h-4 w-4" />
            )}
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

        <h3 className="absolute top-1/2 left-1/2 max-w-[60%] -translate-1/2 truncate text-center">
          {viewMode === 'single' ? currentImage?.filename : comic.title}
        </h3>

        <span>
          {currentIndex + 1} / {images.length}
        </span>
      </div>

      <div className="bg-surface flex h-0 flex-1 items-center justify-center overflow-hidden">
        {viewMode === 'single' ? (
          <ImagePreview
            comicId={comicId}
            images={images}
            index={currentIndex}
            onIndexChange={jumpTo}
            onTags={updateComicImageTags}
          />
        ) : (
          <ComicStrip
            key={comicId}
            ref={stripRef}
            className="h-full w-full"
            comicId={comicId}
            images={images}
            initialIndex={currentIndex}
            orientation="horizontal"
            overscanViewports={4}
            maxRenderedPages={32}
            onCurrentIndexChange={handleStripIndexChange}
            onTags={updateComicImageTags}
          />
        )}
      </div>
    </div>
  )
}
