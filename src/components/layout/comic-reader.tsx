import {
  CircleChevronLeft,
  CircleChevronRight,
  Columns2,
  Square,
  SquareMenu,
  Star,
  Trash2,
} from 'lucide-react'
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TagButtons } from '@/components/ui/tag-buttons'
import { ComicHorizontalList } from '@/components/ui/virtuoso-config'
import { useClickOutside } from '@/hooks/use-click-outside'
import { debounce } from '@/lib/helper'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import type { FileTags, Image } from '@/types/library'

type ViewMode = 'single' | 'scroll'

const EMPTY_ARRAY: Image[] = []

interface TableOfContentsProps {
  images: Image[]
  currentIndex: number
  isCollapsed: boolean
  onSelect: (index: number) => void
  onTags: (image: Image, tags: FileTags) => void
  onClose: () => void
}

const TableOfContents = memo(function TableOfContents({
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
      <ScrollArea
        ref={scrollRef}
        orientation="horizontal"
        className="flex gap-1 p-2"
      >
        {images.map((image) => (
          <div
            key={image.index}
            data-index={image.index}
            className={cn(
              'flex w-[100px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all',
              currentIndex === image.index && 'bg-overlay ring-rose ring-2',
              image.deleted && 'opacity-40',
              image.starred ? 'bg-love/50' : 'hover:bg-overlay',
            )}
            onClick={() => onSelect(image.index)}
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
                onStar={(e) => {
                  e.stopPropagation()
                  onTags(image, { starred: !image.starred })
                }}
                onDelete={(e) => {
                  e.stopPropagation()
                  onTags(image, { deleted: !image.deleted })
                }}
                size="sm"
              />
            </div>
          </div>
        ))}
      </ScrollArea>
    </div>
  )
})

interface SingleImageProps {
  image: Image
  onTags: (image: Image, tags: FileTags) => void
}

const SingleImage = memo(function SingleImage({
  image,
  onTags,
}: SingleImageProps) {
  return (
    <div
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
          onStar={(e) => {
            e.stopPropagation()
            onTags(image, { starred: !image.starred })
          }}
          onDelete={(e) => {
            e.stopPropagation()
            onTags(image, { deleted: !image.deleted })
          }}
          size="md"
        />
      </figure>
    </div>
  )
})

interface ScrollImageProps {
  image: Image
  onTags: (image: Image, tags: FileTags) => void
  onVisible?: (index: number, isVisible: boolean) => void
}

const ScrollImage = memo(function ScrollImage({
  image,
  onTags,
  onVisible,
}: ScrollImageProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !onVisible) return

    const observer = new IntersectionObserver(
      ([entry]) => onVisible(image.index, entry.isIntersecting),
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [image.index, onVisible])

  return (
    <div
      ref={ref}
      data-index={image.index}
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
      />
      <TagButtons
        starred={image.starred}
        deleted={image.deleted}
        onStar={(e) => {
          e.stopPropagation()
          onTags(image, { starred: !image.starred })
        }}
        onDelete={(e) => {
          e.stopPropagation()
          onTags(image, { deleted: !image.deleted })
        }}
        size="md"
      />
    </div>
  )
})

interface ComicReaderProps {
  comicId: string
}

export const ComicReader = memo(function ComicReader({
  comicId,
}: ComicReaderProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  const [isTocCollapsed, setTocCollapsed] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('scroll')

  const comic = useLibraryStore((s) => s.comics[comicId])
  const images = useLibraryStore(
    (s) => s.comicImages[comicId]?.images ?? EMPTY_ARRAY,
  )

  const getComicImages = useLibraryStore((s) => s.getComicImages)
  const updateComicTags = useLibraryStore((s) => s.updateComicTags)
  const updateComicImageTags = useLibraryStore((s) => s.updateComicImageTags)
  const updateComicProgress = useProgressStore((s) => s.updateComicProgress)
  const isImmersive = useUIStore((s) => s.isImmersive)
  const activeTab = useTabsStore((s) => s.activeTab)

  const progress = useProgressStore((s) => s.comics[comicId])
  const [currentIndex, setCurrentIndex] = useState(progress?.current ?? 0)

  const stateRef = useRef({ activeTab, comic, images, currentIndex })
  // eslint-disable-next-line react-hooks/refs
  stateRef.current = { activeTab, comic, images, currentIndex }

  const visibleIndices = useRef(new Set<number>())
  const syncCurrentIndex = useRef(
    // eslint-disable-next-line react-hooks/refs
    debounce(() => {
      if (!visibleIndices.current.size) return
      const minIndex = Math.min(...visibleIndices.current)
      if (minIndex === stateRef.current.currentIndex) return
      setCurrentIndex(minIndex)
    }, 60),
  )

  const handleImageVisible = useCallback(
    (index: number, isVisible: boolean) => {
      if (isVisible) {
        visibleIndices.current.add(index)
      } else {
        visibleIndices.current.delete(index)
      }
      syncCurrentIndex.current()
    },
    [],
  )

  const jumpTo = useCallback(
    (index: number) => {
      const newIndex = Math.max(0, Math.min(index, images.length - 1))
      if (newIndex === stateRef.current.currentIndex) return
      setCurrentIndex(newIndex)

      if (viewMode === 'scroll') {
        virtuosoRef.current?.scrollToIndex({
          index: newIndex,
          align: 'start',
        })
      }
    },
    [images.length, viewMode],
  )

  useEffect(() => {
    if (images.length === 0) {
      void getComicImages(comicId)
    }
  }, [comicId, images.length, getComicImages])

  useLayoutEffect(() => {
    const { comic, images } = stateRef.current
    if (!images || activeTab !== comic?.path) return

    const progress = useProgressStore.getState().comics[comic.id]
    if (progress?.current !== undefined) {
      jumpTo(progress.current)
    }
  }, [activeTab, images.length, comicId, jumpTo])

  useEffect(() => {
    const { images, comic } = stateRef.current
    if (!images.length) return

    const newProgress = {
      current: currentIndex,
      total: images.length,
      percent:
        images.length > 1 ? (currentIndex / (images.length - 1)) * 100 : 100,
      lastRead: Date.now(),
    }
    updateComicProgress(comic.id, newProgress)
  }, [currentIndex, updateComicProgress, images.length])

  const toggleToc = useCallback(() => {
    setTocCollapsed((prev) => !prev)
  }, [])

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'single' ? 'scroll' : 'single'))
  }, [])

  const handleSetImageTags = useCallback(
    (image: Image, tags: FileTags) => {
      void updateComicImageTags(comicId, image.filename, tags)
    },
    [comicId, updateComicImageTags],
  )

  const handleSetComicTags = useCallback(
    (tags: FileTags) => {
      void updateComicTags(comicId, tags)
    },
    [comicId, updateComicTags],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const { activeTab, comic, images, currentIndex } = stateRef.current
      if (activeTab !== comic?.path) return

      const key = e.key.toUpperCase()
      if (key === 'ARROWUP') {
        jumpTo(stateRef.current.currentIndex - 1)
      } else if (key === 'ARROWDOWN') {
        jumpTo(stateRef.current.currentIndex + 1)
      } else if (key === 'B') {
        toggleViewMode()
      } else if (key === 'T') {
        toggleToc()
      } else if (key === 'C') {
        handleSetComicTags({ deleted: !comic.deleted })
      } else if (key === 'V') {
        handleSetComicTags({ starred: !comic.starred })
      } else if (key === 'N') {
        const currentImage = images[currentIndex]
        handleSetImageTags(currentImage, {
          deleted: !currentImage.deleted,
        })
      } else if (key === 'M') {
        const currentImage = images[currentIndex]
        handleSetImageTags(currentImage, {
          starred: !currentImage.starred,
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    jumpTo,
    toggleViewMode,
    handleSetImageTags,
    toggleToc,
    handleSetComicTags,
  ])

  const renderScrollImage = useCallback(
    (_index: number, image: Image) => (
      <ScrollImage
        image={image}
        onTags={handleSetImageTags}
        onVisible={handleImageVisible}
      />
    ),
    [handleSetImageTags, handleImageVisible],
  )

  const currentImage = images[currentIndex]

  if (!comic) return null

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {images.length > 0 && (
        <TableOfContents
          images={images}
          currentIndex={currentIndex}
          isCollapsed={isTocCollapsed}
          onSelect={jumpTo}
          onTags={handleSetImageTags}
          onClose={() => setTocCollapsed(true)}
        />
      )}
      {!isImmersive && (
        <div className="bg-base text-subtle flex h-8 w-full items-center border-b px-2 text-xs">
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
            onClick={() => handleSetComicTags({ deleted: !comic.deleted })}
            title="标记删除"
          >
            <Trash2
              className={cn(
                'h-4 w-4',
                comic.deleted && 'text-love fill-gold/80',
              )}
            />
          </Button>

          <Button
            className="h-6 w-6"
            onClick={() => handleSetComicTags({ starred: !comic.starred })}
            title="标记收藏"
          >
            <Star
              className={cn(
                'h-4 w-4',
                comic.starred && 'text-love fill-gold/80',
              )}
            />
          </Button>

          <h3 className="flex flex-1 justify-center truncate text-center">
            {viewMode === 'single' ? currentImage?.filename : comic.title}
          </h3>

          <span>
            {currentIndex} / {images.length}
          </span>
        </div>
      )}
      <div className="bg-surface flex h-0 flex-1 items-center justify-center overflow-hidden">
        {viewMode === 'single' && currentImage && (
          <>
            <SingleImage image={currentImage} onTags={handleSetImageTags} />

            {currentIndex > 0 && (
              <Button
                className="hover:text-love transition-color text-subtle/60 absolute top-1/2 left-4 -translate-y-1/2 bg-transparent hover:bg-transparent"
                onClick={() => jumpTo(stateRef.current.currentIndex - 1)}
              >
                <CircleChevronLeft className="h-10 w-10" />
              </Button>
            )}

            {currentIndex < images.length - 1 && (
              <Button
                className="hover:text-love transition-color text-subtle/60 absolute top-1/2 right-4 -translate-y-1/2 bg-transparent hover:bg-transparent"
                onClick={() => jumpTo(stateRef.current.currentIndex + 1)}
              >
                <CircleChevronRight className="h-10 w-10" />
              </Button>
            )}
          </>
        )}

        {viewMode === 'scroll' && (
          <Virtuoso
            ref={virtuosoRef}
            className="h-full w-full"
            horizontalDirection
            data={images}
            initialTopMostItemIndex={currentIndex}
            itemContent={renderScrollImage}
            increaseViewportBy={3000}
            components={ComicHorizontalList}
          />
        )}
      </div>
    </div>
  )
})
