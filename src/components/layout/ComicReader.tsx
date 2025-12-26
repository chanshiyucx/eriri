import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  CircleChevronLeft,
  CircleChevronRight,
  Columns2,
  Square,
  SquareMenu,
  Star,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { setFileStar } from '@/lib/scanner'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/store/library'
import { useUIStore } from '@/store/ui'
import type { Image } from '@/types/library'

interface ComicReaderProps {
  libraryId: string
  comicId: string
}

type ViewMode = 'single' | 'double'

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
      isActive && 'bg-overlay text-rose',
    )}
    onClick={() => onClick(index)}
  >
    {image.filename}
  </div>
))
TocItem.displayName = 'TocItem'

interface ComicImageProps {
  image: Image
  previousImage?: Image
  isLoaded: boolean
  onLoad: (url: string) => void
  onStar: (image: Image) => Promise<void>
}

const ComicImage = memo(
  ({ image, previousImage, isLoaded, onLoad, onStar }: ComicImageProps) => (
    <div className="group relative flex h-full items-center justify-center">
      {/* Previous image - visible until new image loads */}
      {previousImage && !isLoaded && (
        <img
          src={previousImage.url}
          alt={previousImage.filename}
          className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
          decoding="async"
        />
      )}

      {/* Current image - fades in when loaded */}
      <img
        key={image.url}
        src={image.url}
        alt={image.filename}
        className={cn(
          'max-h-full max-w-full object-contain transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0',
        )}
        onLoad={() => onLoad(image.url)}
        decoding="async"
      />

      <Button
        className="absolute top-3 right-3 h-6 w-6 bg-transparent hover:bg-transparent"
        onClick={(e) => {
          e.stopPropagation()
          void onStar(image)
        }}
      >
        <Star
          className={cn(
            'text-love h-5 w-5 opacity-0',
            image.starred ? 'fill-gold opacity-100' : 'group-hover:opacity-100',
          )}
        />
      </Button>
    </div>
  ),
)
ComicImage.displayName = 'ComicImage'

const ComicReader = memo(({ libraryId, comicId }: ComicReaderProps) => {
  const [images, setImages] = useState<Image[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTocCollapsed, setTocCollapsed] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('single')
  const [previousImages, setPreviousImages] = useState<Image[]>([])

  const { toggleImmersive, isImmersive } = useUIStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(false)
  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestProgressRef = useRef<{
    current: number
    total: number
    percent: number
  } | null>(null)
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map())

  const updateComicProgress = useLibraryStore((s) => s.updateComicProgress)
  const getComicImages = useLibraryStore((s) => s.getComicImages)
  const findComic = useLibraryStore((s) => s.findComic)
  const comic = findComic(libraryId, comicId)
  const updateComicImageStarred = useLibraryStore(
    (s) => s.updateComicImageStarred,
  )

  useEffect(() => {
    restoredRef.current = false
    let mounted = true

    const load = async () => {
      try {
        const data = await getComicImages(libraryId, comicId)
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
        updateComicProgress(
          libraryId,
          comicId,
          latestProgressRef.current.current,
          latestProgressRef.current.total,
        )
        latestProgressRef.current = null
      }
    }
  }, [libraryId, comicId, getComicImages, updateComicProgress])

  useEffect(() => {
    if (!images.length || restoredRef.current) return

    const progress = comic?.progress
    if (progress?.current !== undefined) {
      setCurrentIndex(Math.min(progress.current, images.length - 1))
    }

    restoredRef.current = true
  }, [images, comic])

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
        updateComicProgress(
          libraryId,
          comicId,
          latestProgressRef.current.current,
          latestProgressRef.current.total,
        )
      }
      throttleTimeoutRef.current = null
    }, 300)
  }, [currentIndex, images.length, libraryId, comicId, updateComicProgress])

  // Track loaded images to prevent white flash
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())

  const handleImageLoaded = useCallback((url: string) => {
    setLoadedImages((prev) => {
      const next = new Set(prev)
      next.add(url)
      return next
    })
  }, [])

  // Simplified preload: only ±2 images to reduce memory usage
  useEffect(() => {
    if (!images.length) return

    const preloadRange = 2
    const imagesToPreload: Image[] = []

    for (let i = -preloadRange; i <= preloadRange; i++) {
      const index = currentIndex + i
      if (index >= 0 && index < images.length && index !== currentIndex) {
        imagesToPreload.push(images[index])
      }
    }

    // Preload images and cache them
    imagesToPreload.forEach((img) => {
      if (!imageCache.current.has(img.url)) {
        const image = new Image()
        image.src = img.url
        image.onload = () => {
          imageCache.current.set(img.url, image)
          handleImageLoaded(img.url)
        }
      }
    })

    // Clean up distant images (>±5) at appropriate timing
    imageCache.current.forEach((_, url) => {
      const imgIndex = images.findIndex((img) => img.url === url)
      if (imgIndex !== -1 && Math.abs(imgIndex - currentIndex) > 5) {
        imageCache.current.delete(url)
      }
    })
  }, [currentIndex, images, handleImageLoaded])

  // Pre-calculate which positions can show double column
  // This determines if images at index i and i+1 can be displayed side by side
  const canShowDoubleAtPosition = useMemo(() => {
    if (viewMode === 'single' || !containerRef.current) {
      return new Map<number, boolean>()
    }

    const containerWidth = containerRef.current.clientWidth
    const containerHeight = containerRef.current.clientHeight
    const result = new Map<number, boolean>()

    for (let i = 0; i < images.length - 1; i++) {
      const img1 = images[i]
      const img2 = images[i + 1]

      // Calculate scaled widths when both images are fit to container height
      const scaledWidth1 = (img1.width / img1.height) * containerHeight
      const scaledWidth2 = (img2.width / img2.height) * containerHeight

      // Can show double if total width fits in container
      const canFit = scaledWidth1 + scaledWidth2 <= containerWidth
      result.set(i, canFit)
    }

    return result
  }, [images, viewMode])

  // Check if current position can show double column
  const canShowDoubleColumn = canShowDoubleAtPosition.get(currentIndex) ?? false

  const handleNext = useCallback(() => {
    // Save current images as previous before switching
    setPreviousImages([
      images[currentIndex],
      ...(canShowDoubleColumn && images[currentIndex + 1]
        ? [images[currentIndex + 1]]
        : []),
    ])

    setCurrentIndex((prev) => {
      // Advance by 2 if current position shows double column, otherwise by 1
      const currentShowsDouble = canShowDoubleAtPosition.get(prev) ?? false
      const nextIndex = prev + (currentShowsDouble ? 2 : 1)
      return Math.min(nextIndex, images.length - 1)
    })
  }, [currentIndex, images, canShowDoubleColumn, canShowDoubleAtPosition])

  const handlePrevious = useCallback(() => {
    // Save current images as previous before switching
    setPreviousImages([
      images[currentIndex],
      ...(canShowDoubleColumn && images[currentIndex + 1]
        ? [images[currentIndex + 1]]
        : []),
    ])

    setCurrentIndex((prev) => {
      if (prev === 0) return 0

      // Find the previous valid starting position
      // We need to work backwards to find where the previous "page" would start
      let targetIndex = prev - 1

      // Check if position before current can show double
      // If yes, and it would land us at current position, go back 2
      if (targetIndex > 0) {
        const prevPrevCanDouble = canShowDoubleAtPosition.get(targetIndex - 1)
        if (prevPrevCanDouble && targetIndex - 1 + 2 === prev) {
          targetIndex = targetIndex - 1
        }
      }

      return Math.max(targetIndex, 0)
    })
  }, [currentIndex, images, canShowDoubleColumn, canShowDoubleAtPosition])

  // Handle window decorations for immersive mode
  useEffect(() => {
    const appWindow = getCurrentWindow()
    void appWindow.setDecorations(!isImmersive)
  }, [isImmersive])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        toggleImmersive()
      } else if (e.key === 'ArrowLeft') {
        handlePrevious()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNext, handlePrevious, toggleImmersive])

  const handleJumpToImage = useCallback((index: number) => {
    setCurrentIndex(index)
  }, [])

  const toggleToc = useCallback(() => {
    setTocCollapsed((prev) => !prev)
  }, [])

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'single' ? 'double' : 'single'))
  }, [])

  const currentImageNames = useMemo(() => {
    const names: string[] = []
    names.push(images[currentIndex]?.filename ?? '')
    if (canShowDoubleColumn && images[currentIndex + 1]) {
      names.push(images[currentIndex + 1].filename)
    }
    return names.filter(Boolean).join(' • ')
  }, [currentIndex, images, canShowDoubleColumn])

  // Check if TOC item is active
  const isTocItemActive = useCallback(
    (index: number) => {
      return (
        index === currentIndex ||
        (canShowDoubleColumn && index === currentIndex + 1)
      )
    },
    [currentIndex, canShowDoubleColumn],
  )

  const handleStarImage = useCallback(
    async (image: Image) => {
      try {
        const newStarred = !image.starred
        const isSuccess = await setFileStar(image.path, newStarred)
        if (isSuccess) {
          updateComicImageStarred(comicId, image.filename, newStarred)
          setImages((prev) =>
            prev.map((img) =>
              img.filename === image.filename
                ? { ...img, starred: newStarred }
                : img,
            ),
          )
        }
      } catch (error) {
        console.error('Failed to star book:', error)
      }
    },
    [comicId, updateComicImageStarred],
  )

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* TOC Sidebar - only render content when expanded */}
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
                    isActive={isTocItemActive(i)}
                    onClick={handleJumpToImage}
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

          <h3 className="flex-1 truncate text-center">{currentImageNames}</h3>
        </div>
      )}
      <div
        ref={containerRef}
        className="bg-surface flex h-0 flex-1 items-center justify-center overflow-hidden"
      >
        {images.length > 0 && (
          <>
            <ComicImage
              image={images[currentIndex]}
              previousImage={previousImages[0]}
              isLoaded={loadedImages.has(images[currentIndex].url)}
              onLoad={handleImageLoaded}
              onStar={handleStarImage}
            />

            {canShowDoubleColumn && images[currentIndex + 1] && (
              <ComicImage
                image={images[currentIndex + 1]}
                previousImage={previousImages[1]}
                isLoaded={loadedImages.has(images[currentIndex + 1].url)}
                onLoad={handleImageLoaded}
                onStar={handleStarImage}
              />
            )}
          </>
        )}

        {/* Navigation Buttons */}
        {currentIndex > 0 && (
          <Button
            className="hover:text-rose transition-color text-subtle/60 absolute top-1/2 left-4 -translate-y-1/2 bg-transparent hover:bg-transparent"
            onClick={handlePrevious}
          >
            <CircleChevronLeft className="h-10 w-10" />
          </Button>
        )}

        {currentIndex < images.length - 1 && (
          <Button
            className="hover:text-rose transition-color text-subtle/60 absolute top-1/2 right-4 -translate-y-1/2 bg-transparent hover:bg-transparent"
            onClick={handleNext}
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
