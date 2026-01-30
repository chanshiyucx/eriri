import {
  Grid2x2,
  PanelLeftClose,
  PanelLeftOpen,
  Rows2,
  StepForward,
} from 'lucide-react'
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Virtuoso, VirtuosoGrid, type VirtuosoHandle } from 'react-virtuoso'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { GridItem } from '@/components/ui/grid-item'
import {
  GridImage,
  ImagePreview,
  ScrollImage,
} from '@/components/ui/image-view'
import { useCollapse } from '@/hooks/use-collapse'
import { useScrollLock } from '@/hooks/use-scroll-lock'
import { useThrottledProgress } from '@/hooks/use-throttled-progress'
import { createComicProgress } from '@/lib/progress'
import { openPathNative } from '@/lib/scanner'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import {
  LibraryType,
  type Comic,
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
  onDoubleClick?: (id: string) => void
  onTags: (id: string, tags: FileTags) => Promise<void>
}

function ComicItem({
  comic,
  isSelected,
  onClick,
  onDoubleClick,
  onTags,
}: ComicItemProps) {
  const progress = useProgressStore((s) => s.comics[comic.id])

  return (
    <GridItem
      title={comic.title}
      cover={comic.cover}
      starred={comic.starred}
      deleted={comic.deleted}
      isSelected={isSelected}
      progress={progress}
      onClick={() => onClick(comic.id)}
      onDoubleClick={() => onDoubleClick?.(comic.id)}
      onContextMenu={() => void openPathNative(comic.path)}
      onStar={() => void onTags(comic.id, { starred: !comic.starred })}
      onDelete={() => void onTags(comic.id, { deleted: !comic.deleted })}
    />
  )
}

interface ComicLibraryProps {
  selectedLibrary: Library
}

export function ComicLibrary({ selectedLibrary }: ComicLibraryProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const { collapsed, setCollapsed } = useCollapse()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [previewIndex, setPreviewIndex] = useState<number>(-1)
  const sortedIdsCache = useRef<{ libraryId: string; comicIds: string[] }>({
    libraryId: '',
    comicIds: [],
  })

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

      if (sortedIdsCache.current.libraryId !== selectedLibrary.id) {
        const sortedIds = comicIds.toSorted((idA, idB) => {
          const a = s.comics[idA]
          const b = s.comics[idB]
          if (a.deleted !== b.deleted) return a.deleted ? 1 : -1
          if (a.starred !== b.starred) return a.starred ? -1 : 1
          return 0
        })
        sortedIdsCache.current = {
          libraryId: selectedLibrary.id,
          comicIds: sortedIds,
        }
      }

      return sortedIdsCache.current.comicIds.map((id) => s.comics[id])
    }),
  )

  const updateComicProgress = useProgressStore((s) => s.updateComicProgress)
  const progress = useProgressStore((s) => s.comics[comicId])
  const currentIndex = progress?.current ?? 0

  const { isLock, visibleIndices, lockScroll } = useScrollLock()
  const throttledUpdateProgress = useThrottledProgress(updateComicProgress)

  const jumpTo = useEffectEvent((targetIndex?: number) => {
    const index = targetIndex ?? currentIndex
    const newProgress = createComicProgress(index, images.length)
    updateComicProgress(comic.id, newProgress)

    if (viewMode === 'scroll') {
      lockScroll()
      virtuosoRef.current?.scrollToIndex({
        index,
        align: 'center',
      })
    }
  })

  useEffect(() => {
    if (images.length) return
    void getComicImages(comicId)
  }, [comicId, images.length, getComicImages])

  useLayoutEffect(() => {
    lockScroll()
  }, [lockScroll, comicId, viewMode, collapsed])

  useLayoutEffect(() => {
    jumpTo()
  }, [activeTab])

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === 'grid' ? 'scroll' : 'grid'))
  }

  const handleContinueReading = () => {
    if (!comic) return

    addTab({
      type: LibraryType.comic,
      id: comic.id,
      title: comic.title,
    })
    setActiveTab(comic.id)
  }

  const handleSelectComic = (id: string) => {
    if (id === comic?.id) return
    updateLibrary(selectedLibrary.id, { status: { comicId: id } })
  }

  const handleImageClick = (index: number) => {
    const newProgress = createComicProgress(index, images.length)
    updateComicProgress(comic.id, newProgress)

    addTab({
      type: LibraryType.comic,
      id: comic.id,
      title: comic.title,
    })
  }

  const handleImageVisible = (index: number, isVisible: boolean) => {
    if (isLock.current) return

    if (isVisible) {
      visibleIndices.current.add(index)
    } else {
      visibleIndices.current.delete(index)
    }
    if (!visibleIndices.current.size) return
    const newIndex = Math.min(...visibleIndices.current)

    if (
      !comic ||
      !images.length ||
      currentIndex === newIndex ||
      collapsed === 2
    ) {
      return
    }

    const newProgress = createComicProgress(newIndex, images.length)
    throttledUpdateProgress.current(comic.id, newProgress)
  }

  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (activeTab || !comic) return

    switch (e.code) {
      case 'KeyC':
        void updateComicTags(comic.id, { deleted: !comic.deleted })
        break
      case 'KeyV':
        void updateComicTags(comic.id, { starred: !comic.starred })
        break
      case 'KeyP':
        handleContinueReading()
        break
      case 'KeyB':
        toggleViewMode()
        break
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const renderComicItem = (_index: number, comic: Comic) => (
    <ComicItem
      comic={comic}
      isSelected={comicId === comic.id}
      onClick={handleSelectComic}
      onTags={updateComicTags}
    />
  )

  const renderGridImage = (_index: number, img: Image) => (
    <GridImage
      comicId={comicId}
      image={img}
      onDoubleClick={setPreviewIndex}
      onContextMenu={handleImageClick}
      onTags={updateComicImageTags}
    />
  )

  const renderScrollImage = (_index: number, image: Image) => (
    <ScrollImage
      comicId={comicId}
      image={image}
      onDoubleClick={setPreviewIndex}
      onContextMenu={handleImageClick}
      onTags={updateComicImageTags}
      onVisible={handleImageVisible}
    />
  )

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
        <div className="bg-base text-subtle flex h-8 items-center justify-between border-b px-3 text-xs">
          <div className="flex gap-2">
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
          <span>COMICS ({comics.length})</span>
        </div>
        <VirtuosoGrid
          className="flex-1"
          data={comics}
          itemContent={renderComicItem}
          listClassName="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))]"
          increaseViewportBy={600}
        />
      </div>

      {/* Right Column: Comic Detail */}
      <div
        className={cn(
          'flex shrink-0 flex-col',
          collapsed === 2 ? 'hidden' : 'flex-1',
        )}
      >
        <div className="bg-base text-subtle relative flex h-8 items-center justify-between border-b px-3 text-xs">
          <div className="flex gap-2">
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
              onClick={handleContinueReading}
              title="继续阅读"
            >
              <StepForward className="h-4 w-4" />
            </Button>
          </div>

          <h3 className="absolute top-1/2 left-1/2 max-w-[60%] -translate-1/2 truncate text-center">
            {comic?.title}
          </h3>

          <span>
            {currentIndex + 1} / {images.length}
          </span>
        </div>
        {viewMode === 'grid' ? (
          <VirtuosoGrid
            key={comicId}
            className="flex-1"
            data={images}
            itemContent={renderGridImage}
            listClassName="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))]"
            increaseViewportBy={600}
          />
        ) : (
          <Virtuoso
            key={comicId}
            ref={virtuosoRef}
            className="flex-1"
            data={images}
            initialTopMostItemIndex={currentIndex}
            itemContent={renderScrollImage}
            increaseViewportBy={2000}
          />
        )}
      </div>

      {/* Fullscreen Preview Overlay */}
      <div
        className={cn(
          'bg-base fixed inset-0 z-100 flex items-center justify-center',
          previewIndex >= 0 ? 'visible' : 'hidden',
        )}
      >
        <ImagePreview
          comicId={comicId}
          images={images}
          index={previewIndex}
          onIndexChange={setPreviewIndex}
          onTags={updateComicImageTags}
          onDoubleClick={() => setPreviewIndex(-1)}
          onContextMenu={(idx: number) => {
            setPreviewIndex(-1)
            handleImageClick(idx)
          }}
        />
      </div>
    </div>
  )
}
