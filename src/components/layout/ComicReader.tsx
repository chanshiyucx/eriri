import {
  CircleChevronLeft,
  CircleChevronRight,
  Columns2,
  Square,
  SquareMenu,
  Star,
  Trash2,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useComicNavigation } from '@/hooks/useComicNavigation'
import { throttle } from '@/lib/helper'
import { setFileTag } from '@/lib/scanner'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import type { FileTags, Image } from '@/types/library'

type ViewMode = 'single' | 'double'
type ImagePosition = 'center' | 'left' | 'right'

interface TocItemProps {
  image: Image
  index: number
  isActive: boolean
  onClick: (index: number) => void
}

const TocItem = memo(({ image, index, isActive, onClick }: TocItemProps) => (
  <div
    className={cn(
      'hover:bg-overlay w-full cursor-pointer truncate px-4 py-2 text-left text-sm',
      isActive && 'bg-overlay text-love',
    )}
    onClick={() => onClick(index)}
  >
    {image.filename}
  </div>
))
TocItem.displayName = 'TocItem'

interface ComicImageProps {
  image: Image
  viewKey: string
  position?: ImagePosition
  onTags: (image: Image, tags: FileTags) => Promise<void>
}

const ComicImage = memo(
  ({ image, viewKey, position, onTags }: ComicImageProps) => {
    const [isLoaded, setIsLoaded] = useState(false)

    return (
      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center',
          image.deleted && 'opacity-50',
        )}
      >
        <img
          key={image.url + viewKey}
          src={image.url}
          alt={image.filename}
          className={cn(
            'absolute inset-0 h-auto h-full w-full object-contain transition-opacity duration-300',
            position === 'left' && 'object-right',
            position === 'right' && 'object-left',
            position === 'center' && 'object-center',
            isLoaded ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={() => setIsLoaded(true)}
          decoding="async"
        />

        <div
          className={cn(
            'group absolute top-0 flex flex-col gap-2 p-2',
            position === 'right' ? 'left-0' : 'right-0',
          )}
        >
          <Button
            className="h-8 w-8 bg-transparent hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
              void onTags(image, { starred: !image.starred })
            }}
          >
            <Star
              className={cn(
                'text-love h-6 w-6 opacity-0',
                image.starred
                  ? 'fill-gold opacity-100'
                  : 'group-hover:opacity-100',
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
                'text-love h-6 w-6 opacity-0',
                image.deleted
                  ? 'fill-gold/80 opacity-100'
                  : 'group-hover:opacity-100',
              )}
            />
          </Button>
        </div>
      </div>
    )
  },
)

ComicImage.displayName = 'ComicImage'

interface ComicReaderProps {
  comicId: string
}

const ComicReader = memo(({ comicId }: ComicReaderProps) => {
  const [images, setImages] = useState<Image[]>([])
  const [isTocCollapsed, setTocCollapsed] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('single')

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const restoredRef = useRef(false)
  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestProgressRef = useRef<{
    current: number
    total: number
    percent: number
  } | null>(null)

  const preloadCache = useRef<Map<string, HTMLImageElement>>(new Map())

  const comic = useLibraryStore((s) => s.comics[comicId])
  const getComicImages = useLibraryStore((s) => s.getComicImages)
  const updateComicProgress = useProgressStore((s) => s.updateComicProgress)
  const updateComicImageTags = useLibraryStore((s) => s.updateComicImageTags)
  const isImmersive = useUIStore((s) => s.isImmersive)
  const activeTab = useTabsStore((s) => s.activeTab)

  const { currentIndex, visibleIndices, jumpTo, goNext, goPrev } =
    useComicNavigation({
      images,
      viewMode,
      containerSize,
      initialIndex: 0,
    })

  useEffect(() => {
    if (!containerRef.current) return

    const measure = () => {
      if (containerRef.current) {
        const newWidth = containerRef.current.clientWidth
        const newHeight = containerRef.current.clientHeight

        setContainerSize((prev) => {
          if (prev.width === newWidth && prev.height === newHeight) {
            return prev
          }
          return { width: newWidth, height: newHeight }
        })
      }
    }

    const observer = new ResizeObserver(measure)
    observer.observe(containerRef.current)

    measure()

    return () => {
      observer.disconnect()
    }
  }, [isImmersive])

  useEffect(() => {
    restoredRef.current = false
    let mounted = true

    const load = async () => {
      try {
        const data = await getComicImages(comicId)
        if (mounted) {
          setImages(data)
        }
      } catch (e) {
        console.error('Failed to load comic images', e)
      }
    }

    void load()

    return () => {
      mounted = false
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
  }, [comicId, getComicImages, updateComicProgress])

  useEffect(() => {
    if (!images.length || restoredRef.current) return

    const progress = useProgressStore.getState().comics[comicId]
    if (progress?.current !== undefined) {
      jumpTo(Math.min(progress.current, images.length - 1))
    }

    restoredRef.current = true
  }, [images, comicId, jumpTo])

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
      if (!preloadCache.current.has(url)) {
        const img = new Image()
        img.src = url
        preloadCache.current.set(url, img)
      }
    })

    if (preloadCache.current.size > 50) {
      preloadCache.current.clear()
    }
  }, [currentIndex, visibleIndices, images])

  const toggleToc = useCallback(() => {
    setTocCollapsed((prev) => !prev)
  }, [])

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'single' ? 'double' : 'single'))
  }, [])

  const currentImageNames = useMemo(() => {
    return visibleIndices.map((i) => images[i]?.filename).filter(Boolean)
  }, [visibleIndices, images])

  const handleSetImageTags = useCallback(
    async (image: Image, tags: FileTags) => {
      try {
        const isSuccess = await setFileTag(image.path, tags)
        if (isSuccess) {
          updateComicImageTags(comicId, image.filename, tags)
          setImages((prev) =>
            prev.map((img) =>
              img.filename === image.filename ? { ...img, ...tags } : img,
            ),
          )
        }
      } catch (error) {
        console.error('Failed to set image tag:', error)
      }
    },
    [comicId, updateComicImageTags],
  )

  const throttledNext = useMemo(
    () => throttle(goNext, 80) as unknown as () => void,
    [goNext],
  )
  const throttledPrev = useMemo(
    () => throttle(goPrev, 80) as unknown as () => void,
    [goPrev],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== comic.path) return
      if (e.key === 'ArrowLeft') {
        throttledPrev()
      } else if (e.key === 'ArrowRight') {
        throttledNext()
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
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    comic,
    activeTab,
    throttledNext,
    throttledPrev,
    images,
    visibleIndices,
    handleSetImageTags,
  ])

  const isReady = images.length > 0 && containerSize.width > 0

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {images.length > 0 && (
        <div
          className={cn(
            'bg-base absolute left-0 z-100 flex h-full flex-col transition-all duration-300 ease-in-out',
            isTocCollapsed ? 'w-0' : 'w-64 border-r',
            isImmersive ? 'top-0' : 'top-0',
          )}
        >
          {!isTocCollapsed && (
            <ScrollArea className="h-0 flex-1">
              <div className="w-64">
                {images.map((image, i) => (
                  <TocItem
                    key={i}
                    image={image}
                    index={i}
                    isActive={visibleIndices.includes(i)}
                    onClick={jumpTo}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
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
            title={`Switch to ${viewMode === 'single' ? 'Double' : 'Single'} Column`}
          >
            {viewMode === 'single' ? (
              <Square className="h-4 w-4" />
            ) : (
              <Columns2 className="h-4 w-4" />
            )}
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
            {visibleIndices.map((index) => {
              const img = images[index]
              const isSpread =
                viewMode === 'double' && visibleIndices.length > 1
              let pos: ImagePosition = 'center'
              if (isSpread) {
                pos = index === 0 ? 'left' : 'right'
              }

              return (
                <ComicImage
                  key={img.url + viewMode}
                  image={img}
                  viewKey={viewMode}
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

ComicReader.displayName = 'ComicReader'

export { ComicReader }
