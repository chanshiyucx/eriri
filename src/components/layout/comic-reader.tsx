import { throttle } from 'lodash-es'
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
import { ScrollImage, SingleImage } from '@/components/ui/image-view'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TagButtons } from '@/components/ui/tag-buttons'
import { useClickOutside } from '@/hooks/use-click-outside'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import type { ComicProgress, FileTags, Image } from '@/types/library'

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
                onStar={() => onTags(image, { starred: !image.starred })}
                onDelete={() => onTags(image, { deleted: !image.deleted })}
                size="sm"
              />
            </div>
          </div>
        ))}
      </ScrollArea>
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
  const isAutoScrolling = useRef(false)
  const visibleIndices = useRef(new Set<number>())
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
  const currentIndex = progress?.current ?? 0

  const stateRef = useRef({ activeTab, comic, images, currentIndex })
  // eslint-disable-next-line react-hooks/refs
  stateRef.current = { activeTab, comic, images, currentIndex }

  const throttledUpdateProgress = useRef(
    throttle(
      (comicId: string, progress: ComicProgress) =>
        updateComicProgress(comicId, progress),
      300,
      { leading: false, trailing: true },
    ),
  )

  useEffect(() => {
    const throttled = throttledUpdateProgress.current
    return () => {
      throttled.flush()
      throttled.cancel()
    }
  }, [])

  useEffect(() => {
    if (images.length) return
    void getComicImages(comicId)
  }, [comicId, images.length, getComicImages])

  const jumpTo = useCallback(
    (index: number) => {
      const total = images.length
      const percent = total > 1 ? (index / (total - 1)) * 100 : 100
      const newProgress = {
        current: index,
        total,
        percent,
        lastRead: Date.now(),
      }
      updateComicProgress(comicId, newProgress)

      if (viewMode === 'scroll') {
        console.log('滚动锁定并跳转：', index)
        isAutoScrolling.current = true
        visibleIndices.current.clear()
        virtuosoRef.current?.scrollToIndex({
          index,
          align: 'center',
        })

        setTimeout(() => {
          console.log('解除锁定')
          isAutoScrolling.current = false
        }, 500)
      }
    },
    [updateComicProgress, images.length, viewMode, comicId],
  )

  useLayoutEffect(() => {
    const { comic, images, currentIndex } = stateRef.current
    if (!images.length || activeTab !== comic.id) return
    jumpTo(currentIndex)
  }, [activeTab, jumpTo])

  const handleImageVisible = useCallback(
    (index: number, isVisible: boolean) => {
      if (isAutoScrolling.current) {
        console.log('自动滚动中，忽略更新')
        return
      }

      if (isVisible) {
        visibleIndices.current.add(index)
      } else {
        visibleIndices.current.delete(index)
      }
      if (!visibleIndices.current.size) return
      const newIndex = Math.min(...visibleIndices.current)

      const { comic, images, currentIndex } = stateRef.current
      if (!comic || !images.length) return

      if (currentIndex === newIndex) return

      const total = images.length
      const percent = total > 1 ? (newIndex / (total - 1)) * 100 : 100

      const newProgress = {
        current: newIndex,
        total,
        percent,
        lastRead: Date.now(),
      }

      console.log('更新进度:', newIndex, visibleIndices.current)
      throttledUpdateProgress.current(comic.id, newProgress)
    },
    [],
  )

  const toggleToc = useCallback(() => {
    setTocCollapsed((prev) => !prev)
  }, [])

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'single' ? 'scroll' : 'single'))
  }, [])

  const handleSetComicTags = useCallback(
    (tags: FileTags) => {
      void updateComicTags(comicId, tags)
    },
    [comicId, updateComicTags],
  )

  const handleSetImageTags = useCallback(
    (image: Image, tags: FileTags) => {
      void updateComicImageTags(comicId, image.filename, tags)
    },
    [comicId, updateComicImageTags],
  )

  const handleCloseToc = useCallback(() => {
    setTocCollapsed(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const { activeTab, comic, images, currentIndex } = stateRef.current
      if (activeTab !== comic.id) return

      switch (e.code) {
        case 'ArrowUp':
          jumpTo(currentIndex - 1)
          break
        case 'ArrowDown':
          jumpTo(currentIndex + 1)
          break
        case 'KeyB':
          toggleViewMode()
          break
        case 'KeyT':
          toggleToc()
          break
        case 'KeyC':
          handleSetComicTags({ deleted: !comic.deleted })
          break
        case 'KeyV':
          handleSetComicTags({ starred: !comic.starred })
          break
        case 'KeyN': {
          const currentImage = images[currentIndex]
          handleSetImageTags(currentImage, { deleted: !currentImage.deleted })
          break
        }
        case 'KeyM': {
          const currentImage = images[currentIndex]
          handleSetImageTags(currentImage, { starred: !currentImage.starred })
          break
        }
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

  if (!comic || !images.length) return null

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <TableOfContents
        images={images}
        currentIndex={currentIndex}
        isCollapsed={isTocCollapsed}
        onSelect={jumpTo}
        onTags={handleSetImageTags}
        onClose={handleCloseToc}
      />

      <div
        className={cn(
          'bg-base text-subtle flex h-8 w-full items-center border-b px-2 text-xs',
          isImmersive && 'hidden',
        )}
      >
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
            className={cn('h-4 w-4', comic.deleted && 'text-love fill-gold/80')}
          />
        </Button>

        <Button
          className="h-6 w-6"
          onClick={() => handleSetComicTags({ starred: !comic.starred })}
          title="标记收藏"
        >
          <Star
            className={cn('h-4 w-4', comic.starred && 'text-love fill-gold/80')}
          />
        </Button>

        <h3 className="flex flex-1 justify-center truncate text-center">
          {viewMode === 'single' ? currentImage?.filename : comic.title}
        </h3>

        <span>
          {currentIndex + 1} / {images.length}
        </span>
      </div>

      <div className="bg-surface flex h-0 flex-1 items-center justify-center overflow-hidden">
        {viewMode === 'single' ? (
          <>
            <SingleImage image={currentImage} onTags={handleSetImageTags} />

            {currentIndex > 0 && (
              <Button
                className="hover:text-love transition-color text-subtle/60 absolute top-1/2 left-4 -translate-y-1/2 bg-transparent hover:bg-transparent"
                onClick={() => jumpTo(currentIndex - 1)}
              >
                <CircleChevronLeft className="h-10 w-10" />
              </Button>
            )}

            {currentIndex < images.length - 1 && (
              <Button
                className="hover:text-love transition-color text-subtle/60 absolute top-1/2 right-4 -translate-y-1/2 bg-transparent hover:bg-transparent"
                onClick={() => jumpTo(currentIndex + 1)}
              >
                <CircleChevronRight className="h-10 w-10" />
              </Button>
            )}
          </>
        ) : (
          <Virtuoso
            key={comicId}
            ref={virtuosoRef}
            className="h-full w-full overflow-y-hidden"
            horizontalDirection
            data={images}
            initialTopMostItemIndex={currentIndex}
            itemContent={renderScrollImage}
            overscan={2000}
          />
        )}
      </div>
    </div>
  )
})
