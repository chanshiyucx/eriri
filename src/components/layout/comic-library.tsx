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
import { GridImage, ScrollImage } from '@/components/ui/image-view'
import { TagButtons } from '@/components/ui/tag-buttons'
import { LibraryPadding } from '@/components/ui/virtuoso-config'
import { useCollapse } from '@/hooks/use-collapse'
import { useLatest } from '@/hooks/use-latest'
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
  onTags: (id: string, tags: FileTags) => Promise<void>
}

function ComicItem({ comic, isSelected, onClick, onTags }: ComicItemProps) {
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
      onContextMenu={(e) => {
        e.preventDefault()
        void openPathNative(comic.path)
      }}
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
          onStar={() => void onTags(comic.id, { starred: !comic.starred })}
          onDelete={() => void onTags(comic.id, { deleted: !comic.deleted })}
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
}

interface ComicLibraryProps {
  selectedLibrary: Library
}

export function ComicLibrary({ selectedLibrary }: ComicLibraryProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const { collapsed, setCollapsed } = useCollapse()
  const [viewMode, setViewMode] = useState<ViewMode>('scroll')
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

  const stateRef = useLatest({
    activeTab,
    comic,
    images,
    currentIndex,
    viewMode,
    collapsed,
  })

  const { isLock, visibleIndices, lockScroll } = useScrollLock()
  const throttledUpdateProgress = useThrottledProgress(updateComicProgress)

  useEffect(() => {
    if (images.length) return
    void getComicImages(comicId)
  }, [comicId, images.length, getComicImages])

  const jumpTo = useEffectEvent((index: number) => {
    const { comic, images, viewMode } = stateRef.current
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

  useLayoutEffect(() => {
    lockScroll()
  }, [lockScroll, viewMode, collapsed])

  useLayoutEffect(() => {
    const { images, currentIndex } = stateRef.current
    if (!images.length) return
    jumpTo(currentIndex)
  }, [activeTab, stateRef])

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === 'grid' ? 'scroll' : 'grid'))
  }

  const handleContinueReading = () => {
    const { comic } = stateRef.current
    if (!comic) return

    addTab({
      type: LibraryType.comic,
      id: comic.id,
      title: comic.title,
    })
    setActiveTab(comic.id)
  }

  const handleSelectComic = (id: string) => {
    const { comic } = stateRef.current
    if (id === comic?.id) return
    updateLibrary(selectedLibrary.id, { status: { comicId: id } })
    lockScroll()
  }

  const handleImageClick = (index: number) => {
    const { comic, images } = stateRef.current
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

    const { comic, images, currentIndex, collapsed } = stateRef.current
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

    const { activeTab, comic } = stateRef.current
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
      onClick={handleImageClick}
      onTags={updateComicImageTags}
    />
  )

  const renderScrollImage = (_index: number, image: Image) => (
    <ScrollImage
      comicId={comicId}
      image={image}
      onTags={updateComicImageTags}
      onContextMenu={handleImageClick}
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
        <div className="bg-base text-subtle flex h-8 items-center justify-between border-b px-4 text-xs uppercase">
          <span>Comics ({comics.length})</span>
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
        </div>
        <VirtuosoGrid
          className="flex-1"
          data={comics}
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
          <span>Images ({images.length})</span>
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
            data={images}
            itemContent={renderGridImage}
            components={LibraryPadding}
            listClassName="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] place-items-start gap-3 px-4"
            increaseViewportBy={{ top: 0, bottom: 1000 }}
          />
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
}
