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
import { useComicNavigation } from '@/hooks/use-comic-navigation'
import { throttle } from '@/lib/helper'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import type { FileTags, Image } from '@/types/library'

type ViewMode = 'single' | 'double'
type ImagePosition = 'center' | 'left' | 'right'

interface TableOfContentsProps {
  images: Image[]
  visibleIndicesSet: Set<number>
  isCollapsed: boolean
  onSelect: (index: number) => void
}

const TableOfContents = memo(function TableOfContents({
  images,
  visibleIndicesSet,
  isCollapsed,
  onSelect,
}: TableOfContentsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to keep visible items in view
  useEffect(() => {
    if (isCollapsed || !scrollRef.current) return
    const firstVisible = Array.from(visibleIndicesSet)[0]
    if (firstVisible === undefined) return

    const container = scrollRef.current
    const item = container.querySelector(`[data-index="${firstVisible}"]`)
    if (item) {
      item.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [visibleIndicesSet, isCollapsed])

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
              'group flex w-[100px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all',
              visibleIndicesSet.has(i) && 'bg-overlay ring-rose ring-2',
              image.deleted && 'opacity-40',
              image.starred ? 'bg-love/50' : 'hover:bg-overlay',
            )}
            onClick={() => onSelect(i)}
          >
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm transition-all">
              <img
                src={image.thumbnail}
                alt={image.filename}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />

              <div className="absolute top-1 right-1 left-1 flex justify-between">
                <Star
                  className={cn(
                    'text-love h-4 w-4',
                    image.starred ? 'fill-gold' : 'opacity-0',
                  )}
                />
                <Trash2
                  className={cn(
                    'text-love h-4 w-4',
                    image.deleted ? 'fill-gold/80' : 'opacity-0',
                  )}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

interface ComicImageProps {
  image: Image
  position?: ImagePosition
  onTags: (image: Image, tags: FileTags) => void
}

const ComicImage = memo(function ComicImage({
  image,
  position,
  onTags,
}: ComicImageProps) {
  return (
    <div
      className={cn(
        'relative flex h-full w-full justify-center',
        image.deleted && 'opacity-40',
      )}
    >
      <figure
        className={cn(
          'h-full w-auto',
          position === 'left' && 'absolute top-0 right-0 object-right',
          position === 'right' && 'absolute top-0 left-0 object-left',
          position === 'center' && 'relative object-center',
        )}
      >
        <img
          key={image.url}
          src={image.url}
          alt={image.filename}
          className="block h-full w-auto object-contain select-none"
          decoding="async"
          loading="eager"
        />

        <div className="group absolute top-1.5 right-1.5 left-1.5 flex justify-between">
          <Button
            className="h-8 w-8 bg-transparent hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
              void onTags(image, { starred: !image.starred })
            }}
          >
            <Star
              className={cn(
                'text-love h-6 w-6',
                image.starred
                  ? 'fill-gold/80'
                  : 'opacity-0 group-hover:opacity-100',
              )}
            />
          </Button>

          <Button
            className="h-8 w-8 bg-transparent hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
              void onTags(image, { deleted: !image.deleted })
            }}
          >
            <Trash2
              className={cn(
                'text-love h-6 w-6',
                image.deleted
                  ? 'fill-gold/80'
                  : 'opacity-0 group-hover:opacity-100',
              )}
            />
          </Button>
        </div>
      </figure>
    </div>
  )
})

interface ComicReaderProps {
  comicId: string
}

export const ComicReader = memo(function ComicReader({
  comicId,
}: ComicReaderProps) {
  const [isTocCollapsed, setTocCollapsed] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('double')

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestProgressRef = useRef<{
    current: number
    total: number
    percent: number
  } | null>(null)

  const preloadCache = useRef<Map<string, HTMLImageElement>>(new Map())

  const comic = useLibraryStore((s) => s.comics[comicId])
  const images = useLibraryStore((s) => s.comicImages[comicId]?.images ?? [])
  const getComicImages = useLibraryStore((s) => s.getComicImages)
  const updateComicTags = useLibraryStore((s) => s.updateComicTags)
  const updateComicImageTags = useLibraryStore((s) => s.updateComicImageTags)
  const updateComicProgress = useProgressStore((s) => s.updateComicProgress)
  const isImmersive = useUIStore((s) => s.isImmersive)
  const activeTab = useTabsStore((s) => s.activeTab)

  const { currentIndex, visibleIndices, jumpTo, goNext, goPrev } =
    useComicNavigation({
      images,
      viewMode,
      containerSize,
      initialIndex: 0,
    })

  const stateRef = useRef({
    activeTab,
    comic,
    images,
    visibleIndices,
  })

  stateRef.current = { activeTab, comic, images, visibleIndices }

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      const newWidth = el.clientWidth
      const newHeight = el.clientHeight

      setContainerSize((prev) => {
        if (prev.width === newWidth && prev.height === newHeight) return prev
        return { width: newWidth, height: newHeight }
      })
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
    if (!images.length) return
    if (activeTab !== comic?.path) return

    const progress = useProgressStore.getState().comics[comicId]
    if (progress?.current !== undefined) {
      const targetIndex = Math.min(progress.current, images.length - 1)
      jumpTo(targetIndex)
    }
  }, [images.length, comic?.path, comicId, jumpTo, activeTab])

  useEffect(() => {
    if (!images.length) return

    const newProgress = {
      current: currentIndex,
      total: images.length,
      percent: (currentIndex / (images.length - 1)) * 100,
    }

    latestProgressRef.current = newProgress

    throttleTimeoutRef.current ??= setTimeout(() => {
      if (latestProgressRef.current) {
        updateComicProgress(comicId, {
          ...latestProgressRef.current,
          lastRead: Date.now(),
        })
      }
      throttleTimeoutRef.current = null
    }, 300)
  }, [currentIndex, images.length, comicId, updateComicProgress])

  useEffect(() => {
    if (!images.length) return

    const nextIndexStart = currentIndex + visibleIndices.length
    const prevIndexStart = currentIndex - 1

    const indicesToPreload = [
      ...Array.from({ length: 2 }, (_, i) => nextIndexStart + i),
      prevIndexStart,
    ].filter((i) => i >= 0 && i < images.length)

    indicesToPreload.forEach((idx) => {
      const url = images[idx].url
      if (preloadCache.current.has(url)) return
      const img = new Image()
      img.src = url
      preloadCache.current.set(url, img)
    })

    // Smart cache eviction: keep images near current position
    if (preloadCache.current.size > 50) {
      const nearbyUrls = new Set(
        Array.from({ length: 10 }, (_, i) => [
          images[currentIndex + i]?.url,
          images[currentIndex - i]?.url,
        ])
          .flat()
          .filter(Boolean),
      )

      for (const url of preloadCache.current.keys()) {
        if (!nearbyUrls.has(url)) {
          preloadCache.current.delete(url)
          if (preloadCache.current.size <= 30) break
        }
      }
    }
  }, [currentIndex, visibleIndices.length, images])

  const toggleToc = useCallback(() => {
    setTocCollapsed((prev) => !prev)
  }, [])

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'single' ? 'double' : 'single'))
  }, [])

  const currentImageNames = useMemo(
    () =>
      visibleIndices.flatMap((i) => {
        const name = images[i]?.filename
        return name ? [name] : []
      }),
    [visibleIndices, images],
  )

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

  const throttledNextRef = useRef<ReturnType<typeof throttle> | null>(null)
  const throttledPrevRef = useRef<ReturnType<typeof throttle> | null>(null)

  useEffect(() => {
    throttledNextRef.current = throttle(goNext, 80)
    throttledPrevRef.current = throttle(goPrev, 80)
  }, [goNext, goPrev])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation()

      const { activeTab, comic, images, visibleIndices } = stateRef.current
      if (activeTab !== comic?.path) return

      if (e.key === 'ArrowUp') {
        throttledPrevRef.current?.()
      } else if (e.key === 'ArrowDown') {
        throttledNextRef.current?.()
      } else if (e.key === 'd' || e.key === 'D') {
        toggleViewMode()
      } else if (e.key === 'n' || e.key === 'N') {
        const firstImage = images[visibleIndices[0]]
        if (firstImage) {
          void handleSetImageTags(firstImage, { starred: !firstImage.starred })
        }
      } else if (e.key === 'm' || e.key === 'M') {
        if (visibleIndices[1] !== undefined) {
          const secondImage = images[visibleIndices[1]]
          void handleSetImageTags(secondImage, {
            starred: !secondImage.starred,
          })
        }
      } else if (e.key === 'j' || e.key === 'J') {
        const firstImage = images[visibleIndices[0]]
        if (firstImage) {
          void handleSetImageTags(firstImage, { deleted: !firstImage.deleted })
        }
      } else if (e.key === 'k' || e.key === 'K') {
        if (visibleIndices[1] !== undefined) {
          const secondImage = images[visibleIndices[1]]
          void handleSetImageTags(secondImage, {
            deleted: !secondImage.deleted,
          })
        }
      } else if (e.key === 't' || e.key === 'T') {
        void toggleToc()
      } else if (e.key === 'c' || e.key === 'C') {
        void handleSetComicTags({ deleted: !comic.deleted })
      } else if (e.key === 'v' || e.key === 'V') {
        void handleSetComicTags({ starred: !comic.starred })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleViewMode, handleSetImageTags, toggleToc, handleSetComicTags])

  const visibleIndicesSet = useMemo(
    () => new Set(visibleIndices),
    [visibleIndices],
  )

  const isReady = images.length > 0 && containerSize.width > 0

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {images.length > 0 && (
        <TableOfContents
          images={images}
          visibleIndicesSet={visibleIndicesSet}
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
            title={`切换到 ${viewMode === 'single' ? '双栏' : '单栏'}`}
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
            className={cn('h-6 w-6', comic.deleted && 'hidden')}
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

          <h3 className="flex flex-1 justify-evenly truncate text-center">
            {currentImageNames.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </h3>
        </div>
      )}
      <div
        ref={containerRef}
        className="bg-surface flex h-0 flex-1 items-center justify-center overflow-hidden"
      >
        {isReady && (
          <>
            {visibleIndices.map((index, mapIndex) => {
              const img = images[index]
              const isSpread =
                viewMode === 'double' && visibleIndices.length > 1
              let pos: ImagePosition = 'center'
              if (isSpread) {
                pos = mapIndex === 0 ? 'left' : 'right'
              }

              return (
                <ComicImage
                  key={img.url}
                  image={img}
                  position={pos}
                  onTags={handleSetImageTags}
                />
              )
            })}
          </>
        )}

        {/* Navigation Buttons */}
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
      </div>
    </div>
  )
})
