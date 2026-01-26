import { throttle } from 'lodash-es'
import {
  Funnel,
  Grid2x2,
  PanelLeftClose,
  PanelLeftOpen,
  Rows2,
  StepForward,
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
import { Virtuoso, VirtuosoGrid, type VirtuosoHandle } from 'react-virtuoso'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { GridImage, ScrollImage } from '@/components/ui/image-view'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TagButtons } from '@/components/ui/tag-buttons'
import { LibraryPadding } from '@/components/ui/virtuoso-config'
import { useCollapse } from '@/hooks/use-collapse'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import {
  LibraryType,
  type Comic,
  type ComicProgress,
  type FileTags,
  type Image,
  type Library,
} from '@/types/library'

type ViewMode = 'grid' | 'scroll'

const EMPTY_ARRAY: Image[] = []

interface ComicItemProps {
  comic: Comic
  isSelected: boolean
  onClick: (id: string) => void
  onTags: (comic: Comic, tags: FileTags) => void
}

const ComicItem = memo(function ComicItem({
  comic,
  isSelected,
  onClick,
  onTags,
}: ComicItemProps) {
  const progress = useProgressStore((s) => s.comics[comic.id])

  return (
    <div
      className={cn(
        'flex w-[128px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all',
        isSelected && 'bg-overlay ring-rose ring-2',
        comic.deleted && 'opacity-40',
        comic.starred ? 'bg-love/50' : 'hover:bg-overlay',
      )}
      onClick={() => onClick(comic.id)}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm transition-all">
        <img
          src={comic.cover}
          alt={comic.title}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <TagButtons
          starred={comic.starred}
          deleted={comic.deleted}
          onStar={() => onTags(comic, { starred: !comic.starred })}
          onDelete={() => onTags(comic, { deleted: !comic.deleted })}
          size="sm"
        />
        {comic.pageCount && (
          <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-xs text-white">
            <span>{comic.pageCount}P</span>

            {progress && progress.percent > 0 && (
              <span>{Math.round(progress.percent)}%</span>
            )}
          </div>
        )}

        {progress && progress.percent > 0 && (
          <div className="bg-rose/30 absolute inset-x-0 bottom-0 h-1">
            <div
              className="bg-rose h-full"
              style={{
                width: `${progress.percent}%`,
              }}
            />
          </div>
        )}
      </div>
      <div
        className={cn(
          'truncate text-center text-sm transition-colors',
          isSelected && 'text-love',
        )}
      >
        {comic.title}
      </div>
    </div>
  )
})

interface ComicLibraryProps {
  selectedLibrary: Library
}

export const ComicLibrary = memo(function ComicLibrary({
  selectedLibrary,
}: ComicLibraryProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const isLock = useRef(true)
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const visibleIndices = useRef(new Set<number>())
  const { collapsed, setCollapsed } = useCollapse()
  const [viewMode, setViewMode] = useState<ViewMode>('scroll')
  const [filterComic, setFilterComic] = useState<boolean>(false)
  const [filterImage, setFilterImage] = useState<boolean>(false)

  const activeTab = useTabsStore((s) => s.activeTab)
  const addTab = useTabsStore((s) => s.addTab)
  const setActiveTab = useTabsStore((s) => s.setActiveTab)

  const updateLibrary = useLibraryStore((s) => s.updateLibrary)
  const updateComicTags = useLibraryStore((s) => s.updateComicTags)
  const updateComicImageTags = useLibraryStore((s) => s.updateComicImageTags)
  const getComicImages = useLibraryStore((s) => s.getComicImages)

  const { comicId = '' } = selectedLibrary.status
  const comic = useLibraryStore((s) => s.comics[comicId])
  const images = useLibraryStore(
    (s) => s.comicImages[comicId]?.images ?? EMPTY_ARRAY,
  )
  const comics = useLibraryStore(
    useShallow((s) => {
      const comicIds = s.libraryComics[selectedLibrary.id]
      return comicIds.map((id) => s.comics[id])
    }),
  )

  const updateComicProgress = useProgressStore((s) => s.updateComicProgress)
  const progress = useProgressStore((s) => s.comics[comicId])
  const currentIndex = progress?.current ?? 0

  const stateRef = useRef({
    activeTab,
    comic,
    images,
    currentIndex,
    viewMode,
    filterImage,
    collapsed,
  })
  // eslint-disable-next-line react-hooks/refs
  stateRef.current = {
    activeTab,
    comic,
    images,
    currentIndex,
    viewMode,
    filterImage,
    collapsed,
  }

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

  const lockScroll = useCallback(() => {
    if (lockTimer.current) {
      clearTimeout(lockTimer.current)
    }
    console.log('滚动锁定')
    visibleIndices.current.clear()
    isLock.current = true
    lockTimer.current = setTimeout(() => {
      console.log('解除锁定')
      isLock.current = false
    }, 500)
  }, [])

  const jumpTo = useCallback(
    (index: number) => {
      console.log('跳转索引：', index)
      const { comic, images, viewMode } = stateRef.current
      const total = images.length
      const percent = total > 1 ? (index / (total - 1)) * 100 : 100
      const newProgress = {
        current: index,
        total,
        percent,
        lastRead: Date.now(),
      }
      updateComicProgress(comic.id, newProgress)

      if (viewMode === 'scroll') {
        lockScroll()
        virtuosoRef.current?.scrollToIndex({
          index,
          align: 'center',
        })
      }
    },
    [updateComicProgress, lockScroll],
  )

  useLayoutEffect(() => {
    lockScroll()
  }, [lockScroll, viewMode, filterImage, collapsed])

  useLayoutEffect(() => {
    const { images, currentIndex } = stateRef.current
    if (!images.length) return
    console.log('恢复进度:', currentIndex)
    jumpTo(currentIndex)
  }, [activeTab, jumpTo])

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'grid' ? 'scroll' : 'grid'))
  }, [])

  const toggleFilterComic = useCallback(() => {
    setFilterComic((prev) => !prev)
  }, [])

  const toggleFilterImage = useCallback(() => {
    setFilterImage((prev) => !prev)
  }, [])

  const handleContinueReading = useCallback(() => {
    const { comic } = stateRef.current
    if (!comic) return

    addTab({
      type: LibraryType.comic,
      id: comic.id,
      title: comic.title,
    })
    setActiveTab(comic.id)
  }, [addTab, setActiveTab])

  const handleSetComicTags = useCallback(
    (comic: Comic, tags: FileTags) => {
      void updateComicTags(comic.id, tags)
    },
    [updateComicTags],
  )

  const handleSetImageTags = useCallback(
    (image: Image, tags: FileTags) => {
      const { comic } = stateRef.current
      if (!comic) return

      void updateComicImageTags(comic.id, image.filename, tags)
    },
    [updateComicImageTags],
  )

  const handleSelectComic = useCallback(
    (id: string) => {
      const { comic } = stateRef.current
      if (id === comic?.id) return
      updateLibrary(selectedLibrary.id, { status: { comicId: id } })
      lockScroll()
    },
    [selectedLibrary.id, updateLibrary, lockScroll],
  )

  const handleImageClick = useCallback(
    (index: number) => {
      const { comic, images } = stateRef.current
      if (!comic) return

      const total = images.length
      const percent = total > 1 ? (index / (total - 1)) * 100 : 100

      updateComicProgress(comic.id, {
        current: index,
        total,
        percent,
        lastRead: Date.now(),
      })

      addTab({
        type: LibraryType.comic,
        id: comic.id,
        title: comic.title,
      })
    },
    [updateComicProgress, addTab],
  )

  const handleImageVisible = useCallback(
    (index: number, isVisible: boolean) => {
      if (isLock.current) return

      if (isVisible) {
        visibleIndices.current.add(index)
      } else {
        visibleIndices.current.delete(index)
      }
      if (!visibleIndices.current.size) return
      const newIndex = Math.min(...visibleIndices.current)

      const { comic, images, currentIndex, filterImage, collapsed } =
        stateRef.current
      if (
        !comic ||
        !images.length ||
        currentIndex === newIndex ||
        filterImage ||
        collapsed === 2
      ) {
        return
      }

      const total = images.length
      const percent = total > 1 ? (newIndex / (total - 1)) * 100 : 100

      const newProgress = {
        current: newIndex,
        total,
        percent,
        lastRead: Date.now(),
      }

      console.log('更新进度:', comic.title, newIndex, visibleIndices.current)
      throttledUpdateProgress.current(comic.id, newProgress)
    },
    [],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const { activeTab, comic } = stateRef.current
      if (activeTab || !comic) return

      switch (e.code) {
        case 'KeyC':
          handleSetComicTags(comic, { deleted: !comic.deleted })
          break
        case 'KeyV':
          handleSetComicTags(comic, { starred: !comic.starred })
          break
        case 'KeyP':
          handleContinueReading()
          break
        case 'KeyB':
          toggleViewMode()
          break
        case 'KeyF':
          toggleFilterComic()
          break
        case 'KeyG':
          toggleFilterImage()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    handleSetComicTags,
    handleContinueReading,
    toggleViewMode,
    toggleFilterComic,
    toggleFilterImage,
  ])

  const renderComicItem = useCallback(
    (_index: number, comic: Comic) => (
      <ComicItem
        comic={comic}
        isSelected={comicId === comic.id}
        onClick={handleSelectComic}
        onTags={handleSetComicTags}
      />
    ),
    [comicId, handleSelectComic, handleSetComicTags],
  )

  const renderGridImage = useCallback(
    (_index: number, img: Image) => (
      <GridImage
        image={img}
        onClick={handleImageClick}
        onTags={handleSetImageTags}
      />
    ),
    [handleImageClick, handleSetImageTags],
  )

  const renderScrollImage = useCallback(
    (_index: number, image: Image) => (
      <ScrollImage
        image={image}
        onTags={handleSetImageTags}
        onContextMenu={handleImageClick}
        onVisible={handleImageVisible}
      />
    ),
    [handleSetImageTags, handleImageClick, handleImageVisible],
  )

  const showComics = useMemo(() => {
    return filterComic ? comics.filter((c) => c.starred) : comics
  }, [comics, filterComic])

  const showImages = useMemo(() => {
    return filterImage ? images.filter((img) => img.starred) : images
  }, [images, filterImage])

  return (
    <div className="flex h-full w-full">
      {/* Left Column: Comic List */}
      <div
        className={cn(
          'flex shrink-0 flex-col',
          collapsed === 0 ? 'hidden' : 'flex-1',
          collapsed === 1 && 'border-r',
        )}
      >
        <div className="bg-base text-subtle flex h-8 items-center justify-between border-b px-4 text-xs uppercase">
          <span>Comics ({showComics.length})</span>
          <div className="flex gap-2">
            <Button
              className="h-6 w-6"
              onClick={toggleFilterComic}
              title="过滤漫画"
            >
              <Funnel
                className={cn(
                  'h-4 w-4',
                  filterComic && 'text-love fill-gold/80',
                )}
              />
            </Button>
            <Button
              className="h-6 w-6"
              onClick={() => setCollapsed(collapsed === 1 ? 0 : 1)}
            >
              {collapsed === 0 ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <VirtuosoGrid
          className="flex-1"
          data={showComics}
          itemContent={renderComicItem}
          components={LibraryPadding}
          listClassName="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] place-items-start gap-3 px-4"
          increaseViewportBy={{ top: 0, bottom: 1000 }}
        />
      </div>

      {/* Right Column: Comic Detail */}
      <div
        className={cn(
          'flex shrink-0 flex-col',
          collapsed === 2 ? 'hidden' : 'flex-1',
        )}
      >
        <div className="bg-base text-subtle flex h-8 items-center justify-between border-b px-4 text-xs uppercase">
          <span>Images ({showImages.length})</span>
          <div className="flex gap-2">
            <Button
              className="h-6 w-6"
              onClick={toggleViewMode}
              title={viewMode === 'grid' ? '原图预览' : '网格模式'}
            >
              {viewMode === 'grid' ? (
                <Rows2 className="h-4 w-4" />
              ) : (
                <Grid2x2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              className="h-6 w-6"
              onClick={toggleFilterImage}
              title="过滤图片"
            >
              <Funnel
                className={cn(
                  'h-4 w-4',
                  filterImage && 'text-love fill-gold/80',
                )}
              />
            </Button>
            <Button
              className="h-6 w-6"
              onClick={handleContinueReading}
              title="继续阅读"
            >
              <StepForward className="h-4 w-4" />
            </Button>
            <Button
              className="h-6 w-6"
              onClick={() => setCollapsed(collapsed === 1 ? 2 : 1)}
            >
              {collapsed === 2 ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {viewMode === 'grid' ? (
          <VirtuosoGrid
            key={comicId}
            className="flex-1"
            data={showImages}
            itemContent={renderGridImage}
            components={LibraryPadding}
            listClassName="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] place-items-start gap-3 px-4"
            increaseViewportBy={{ top: 0, bottom: 1000 }}
          />
        ) : filterImage ? (
          <ScrollArea viewportClassName="h-0 flex-1">
            {showImages.map((img) => (
              <ScrollImage
                key={img.filename}
                image={img}
                onTags={handleSetImageTags}
                onContextMenu={handleImageClick}
                className="w-full"
              />
            ))}
          </ScrollArea>
        ) : (
          <Virtuoso
            key={comicId}
            ref={virtuosoRef}
            className="flex-1"
            data={images}
            initialTopMostItemIndex={currentIndex}
            itemContent={renderScrollImage}
            increaseViewportBy={1000}
          />
        )}
      </div>
    </div>
  )
})
