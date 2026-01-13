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
  useMemo,
  useRef,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TagButtons } from '@/components/ui/tag-buttons'
import { throttle } from '@/lib/helper'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import type { FileTags, Image } from '@/types/library'

type ViewMode = 'single' | 'scroll'

const calcImageWidth = (img: Image, height: number) =>
  (img.width / img.height) * height

const calcScrollLeft = (images: Image[], targetIndex: number, height: number) =>
  images
    .slice(0, targetIndex)
    .reduce((acc, img) => acc + calcImageWidth(img, height), 0)

interface TableOfContentsProps {
  images: Image[]
  currentIndex: number
  isCollapsed: boolean
  onSelect: (index: number) => void
}

const TableOfContents = memo(function TableOfContents({
  images,
  currentIndex,
  isCollapsed,
  onSelect,
}: TableOfContentsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isCollapsed || !scrollRef.current) return

    const container = scrollRef.current
    const item = container.querySelector(`[data-index="${currentIndex}"]`)
    if (item) {
      item.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [currentIndex, isCollapsed])

  return (
    <div
      className={cn(
        'bg-base absolute right-0 bottom-0 left-0 z-100 border-t',
        'transition-[transform,opacity] duration-300 ease-in-out',
        isCollapsed
          ? 'translate-y-full opacity-0'
          : 'translate-y-0 opacity-100',
      )}
    >
      <div
        ref={scrollRef}
        className="scrollbar-hide flex gap-2 overflow-x-auto p-2"
      >
        {images.map((image, i) => (
          <div
            key={i}
            data-index={i}
            className={cn(
              'flex w-[100px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all',
              currentIndex === i && 'bg-overlay ring-rose ring-2',
              image.deleted && 'opacity-40',
              image.starred ? 'bg-love/50' : 'hover:bg-overlay',
            )}
            onClick={() => onSelect(i)}
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
                size="sm"
              />
            </div>
          </div>
        ))}
      </div>
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
          decoding="async"
          loading="eager"
        />
        <TagButtons
          starred={image.starred}
          deleted={image.deleted}
          onStar={(e) => {
            e.stopPropagation()
            void onTags(image, { starred: !image.starred })
          }}
          onDelete={(e) => {
            e.stopPropagation()
            void onTags(image, { deleted: !image.deleted })
          }}
          size="md"
        />
      </figure>
    </div>
  )
})

interface ScrollImageProps {
  image: Image
  containerHeight: number
  onTags: (image: Image, tags: FileTags) => void
}

const ScrollImage = memo(function ScrollImage({
  image,
  containerHeight,
  onTags,
}: ScrollImageProps) {
  const width = calcImageWidth(image, containerHeight)

  return (
    <div
      className={cn(
        'relative shrink-0 cursor-pointer bg-cover bg-center',
        image.deleted && 'opacity-40',
      )}
      style={{
        width,
        height: containerHeight,
        backgroundImage: `url(${image.thumbnail})`,
      }}
    >
      <img
        src={image.url}
        alt={image.filename}
        className="h-full w-full object-contain"
        loading="lazy"
        decoding="async"
      />
      <TagButtons
        starred={image.starred}
        deleted={image.deleted}
        onStar={(e) => {
          e.stopPropagation()
          void onTags(image, { starred: !image.starred })
        }}
        onDelete={(e) => {
          e.stopPropagation()
          void onTags(image, { deleted: !image.deleted })
        }}
        size="md"
      />
    </div>
  )
})

interface ComicReaderProps {
  comicId: string
}

const EMPTY_ARRAY: Image[] = []

export const ComicReader = memo(function ComicReader({
  comicId,
}: ComicReaderProps) {
  const [containerHeight, setContainerHeight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [isTocCollapsed, setTocCollapsed] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('scroll')
  const [currentIndex, setCurrentIndex] = useState(0)

  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestProgressRef = useRef<{
    current: number
    total: number
    percent: number
  } | null>(null)

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

  const stateRef = useRef({ activeTab, comic, images, currentIndex })
  stateRef.current = { activeTab, comic, images, currentIndex }

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      const newHeight = el.clientHeight
      setContainerHeight((prev) => (prev === newHeight ? prev : newHeight))
    }

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (images.length === 0) {
      void getComicImages(comicId)
    }
  }, [comicId, images.length, getComicImages])

  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
        throttleTimeoutRef.current = null
      }
      if (latestProgressRef.current) {
        updateComicProgress(comicId, {
          ...latestProgressRef.current,
          lastRead: Date.now(),
        })
        latestProgressRef.current = null
      }
    }
  }, [comicId, updateComicProgress])

  useEffect(() => {
    const { comic, images: imgs } = stateRef.current
    if (!imgs.length || activeTab !== comic?.path) return

    const progress = useProgressStore.getState().comics[comic.id]
    if (progress?.current !== undefined) {
      const targetIndex = Math.min(progress.current, imgs.length - 1)
      setCurrentIndex(targetIndex)

      if (viewMode === 'scroll' && scrollRef.current) {
        scrollRef.current.scrollLeft = calcScrollLeft(
          imgs,
          targetIndex,
          containerHeight,
        )
      }
    }
  }, [activeTab, images.length, comicId, viewMode, containerHeight])

  useEffect(() => {
    const { images: imgs, comic } = stateRef.current
    if (!imgs.length) return

    const newProgress = {
      current: currentIndex,
      total: imgs.length,
      percent: imgs.length > 1 ? (currentIndex / (imgs.length - 1)) * 100 : 100,
    }

    latestProgressRef.current = newProgress

    throttleTimeoutRef.current ??= setTimeout(() => {
      if (latestProgressRef.current) {
        updateComicProgress(comic.id, {
          ...latestProgressRef.current,
          lastRead: Date.now(),
        })
      }
      throttleTimeoutRef.current = null
    }, 300)
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

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, images.length - 1))
  }, [images.length])

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const jumpTo = useCallback(
    (index: number) => {
      const newIndex = Math.max(0, Math.min(index, images.length - 1))
      setCurrentIndex(newIndex)

      if (viewMode === 'scroll' && scrollRef.current) {
        const scrollLeft = calcScrollLeft(images, newIndex, containerHeight)
        scrollRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
      }
    },
    [images, viewMode, containerHeight],
  )

  const throttledNextRef = useRef<ReturnType<typeof throttle> | null>(null)
  const throttledPrevRef = useRef<ReturnType<typeof throttle> | null>(null)

  useEffect(() => {
    throttledNextRef.current = throttle(goNext, 80)
    throttledPrevRef.current = throttle(goPrev, 80)

    return () => {
      throttledNextRef.current?.cancel?.()
      throttledPrevRef.current?.cancel?.()
    }
  }, [goNext, goPrev])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const {
        activeTab,
        comic,
        images: imgs,
        currentIndex: idx,
      } = stateRef.current
      if (activeTab !== comic?.path) return

      const key = e.key.toUpperCase()
      if (key === 'ARROWUP') {
        throttledPrevRef.current?.()
      } else if (key === 'ARROWDOWN') {
        throttledNextRef.current?.()
      } else if (key === 'D') {
        toggleViewMode()
      } else if (key === 'N') {
        const currentImage = imgs[idx]
        if (currentImage) {
          void handleSetImageTags(currentImage, {
            starred: !currentImage.starred,
          })
        }
      } else if (key === 'J') {
        const currentImage = imgs[idx]
        if (currentImage) {
          void handleSetImageTags(currentImage, {
            deleted: !currentImage.deleted,
          })
        }
      } else if (key === 'T') {
        void toggleToc()
      } else if (key === 'C') {
        void handleSetComicTags({ deleted: !comic.deleted })
      } else if (key === 'V') {
        void handleSetComicTags({ starred: !comic.starred })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleViewMode, handleSetImageTags, toggleToc, handleSetComicTags])

  // Track scroll position to update currentIndex in scroll mode
  const handleScroll = useCallback(() => {
    if (viewMode !== 'scroll' || !scrollRef.current) return

    const scrollLeft = scrollRef.current.scrollLeft
    let accumulatedWidth = 0

    for (let i = 0; i < images.length; i++) {
      const imgWidth = calcImageWidth(images[i], containerHeight)
      if (scrollLeft < accumulatedWidth + imgWidth / 2) {
        setCurrentIndex(i)
        return
      }
      accumulatedWidth += imgWidth
    }
    setCurrentIndex(images.length - 1)
  }, [viewMode, images, containerHeight])

  const throttledScrollHandler = useMemo(
    () => throttle(handleScroll, 100),
    [handleScroll],
  )

  useEffect(() => {
    return () => throttledScrollHandler.cancel?.()
  }, [throttledScrollHandler])

  const currentImage = images[currentIndex]

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {images.length > 0 && (
        <TableOfContents
          images={images}
          currentIndex={currentIndex}
          isCollapsed={isTocCollapsed}
          onSelect={jumpTo}
        />
      )}
      {!isImmersive && (
        <div className="bg-base text-subtle flex h-8 w-full items-center border-b px-2 text-xs">
          <Button
            className="hover:bg-overlay mx-1 h-6 w-6 bg-transparent"
            onClick={toggleToc}
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
            onClick={() => void handleSetComicTags({ deleted: !comic.deleted })}
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
            onClick={() => void handleSetComicTags({ starred: !comic.starred })}
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
            {currentImage?.filename}
          </h3>
        </div>
      )}
      <div
        ref={containerRef}
        className="bg-surface flex h-0 flex-1 items-center justify-center overflow-hidden"
      >
        {viewMode === 'single' && currentImage && (
          <>
            <SingleImage image={currentImage} onTags={handleSetImageTags} />

            {currentIndex > 0 && (
              <Button
                className="hover:text-love transition-color text-subtle/60 absolute top-1/2 left-4 -translate-y-1/2 bg-transparent hover:bg-transparent"
                onClick={goPrev}
              >
                <CircleChevronLeft className="h-10 w-10" />
              </Button>
            )}

            {currentIndex < images.length - 1 && (
              <Button
                className="hover:text-love transition-color text-subtle/60 absolute top-1/2 right-4 -translate-y-1/2 bg-transparent hover:bg-transparent"
                onClick={goNext}
              >
                <CircleChevronRight className="h-10 w-10" />
              </Button>
            )}
          </>
        )}

        {viewMode === 'scroll' && (
          <ScrollArea
            ref={scrollRef}
            className="h-full w-full"
            orientation="horizontal"
            onScroll={throttledScrollHandler}
          >
            <div className="flex h-full">
              {images.map((img) => (
                <ScrollImage
                  key={img.url}
                  image={img}
                  containerHeight={containerHeight}
                  onTags={handleSetImageTags}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
})
