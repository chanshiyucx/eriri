import { Grid2x2, Rows2, StepForward } from 'lucide-react'
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { VirtuosoGrid } from 'react-virtuoso'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { ComicStrip, type ComicStripHandle } from '@/components/ui/comic-strip'
import { GridItem } from '@/components/ui/grid-item'
import { GridImage, ImagePreview } from '@/components/ui/image-view'
import { usePanelNav } from '@/hooks/use-panel-nav'
import { useThrottledProgress } from '@/hooks/use-throttled-progress'
import { createComicProgress } from '@/lib/progress'
import { openPathNative } from '@/lib/scanner'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
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
  const stripRef = useRef<ComicStripHandle>(null)
  const currentIndexRef = useRef(0)
  const { readerVisible, middleClass, readerClass, openReader } = usePanelNav()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [previewIndex, setPreviewIndex] = useState<number>(-1)

  const activeTab = useTabsStore((s) => s.activeTab)
  const addTab = useTabsStore((s) => s.addTab)
  const setActiveTab = useTabsStore((s) => s.setActiveTab)

  const setNavStatus = useUIStore((s) => s.setNavStatus)
  const updateComicTags = useLibraryStore((s) => s.updateComicTags)
  const updateComicImageTags = useLibraryStore((s) => s.updateComicImageTags)
  const getComicImages = useLibraryStore((s) => s.getComicImages)

  const comicId = useUIStore(
    (s) => s.navStatus[selectedLibrary.id]?.comicId ?? '',
  )
  const comic = useLibraryStore((s) => s.comics[comicId])
  const images = useLibraryStore(
    (s) => s.comicImages[comicId]?.images ?? EMPTY_ARRAY,
  )
  const comics = useLibraryStore(
    useShallow((s) => {
      const comicIds = s.libraryComics[selectedLibrary.id] ?? []
      return comicIds
        .map((id) => s.comics[id])
        .toSorted((a, b) => {
          if (a.deleted !== b.deleted) return a.deleted ? 1 : -1
          if (a.starred !== b.starred) return a.starred ? -1 : 1
          return 0
        })
    }),
  )

  const updateComicProgress = useProgressStore((s) => s.updateComicProgress)
  const progress = useProgressStore((s) => s.comics[comicId])
  const savedIndex = progress?.current ?? 0
  const [libraryPosition, setLibraryPosition] = useState({
    comicId,
    index: savedIndex,
  })
  const throttledUpdateProgress = useThrottledProgress(updateComicProgress)

  const currentIndex =
    libraryPosition.comicId === comicId ? libraryPosition.index : savedIndex

  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  const setCurrentIndex = (index: number) => {
    setLibraryPosition((prev) =>
      prev.comicId === comicId && prev.index === index
        ? prev
        : { comicId, index },
    )
  }

  // Gate on `comic` so the load retries once the catalog hydrates (see
  // comic-reader.tsx for the same race).
  const comicPath = comic?.path
  useEffect(() => {
    if (!comicPath || images.length) return
    void getComicImages(comicId)
  }, [comicId, comicPath, images.length, getComicImages])

  useLayoutEffect(() => {
    if (viewMode !== 'scroll' || !readerVisible || !images.length) return
    stripRef.current?.jumpTo(currentIndexRef.current)
  }, [activeTab, readerVisible, comicId, images.length, viewMode])

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
    if (id !== comic?.id) {
      setNavStatus(selectedLibrary.id, { comicId: id })
    }
    openReader()
  }

  const handleImageClick = (index: number) => {
    if (!comic) return
    const newProgress = createComicProgress(index, images.length)
    setCurrentIndex(index)
    updateComicProgress(comic.id, newProgress)

    addTab({
      type: LibraryType.comic,
      id: comic.id,
      title: comic.title,
    })
  }

  const handleStripIndexChange = (index: number) => {
    if (!comic || !images.length || !readerVisible) return

    setCurrentIndex(index)
    const newProgress = createComicProgress(index, images.length)
    throttledUpdateProgress.current(comic.id, newProgress)
  }

  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (!comic) return
    if (activeTab) return

    switch (e.code) {
      case 'KeyP':
        handleContinueReading()
        break
      case 'KeyB':
        toggleViewMode()
        break
      case 'KeyC':
        void updateComicTags(comic.id, { deleted: !comic.deleted })
        break
      case 'KeyV':
        void updateComicTags(comic.id, { starred: !comic.starred })
        break
      case 'KeyN': {
        const currentImage =
          viewMode === 'grid' ? images[previewIndex] : images[currentIndex]
        if (!currentImage) return
        void updateComicImageTags(comic.id, currentImage.filename, {
          deleted: !currentImage.deleted,
        })
        break
      }
      case 'KeyM': {
        const currentImage =
          viewMode === 'grid' ? images[previewIndex] : images[currentIndex]
        if (!currentImage) return
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

  return (
    <div className="flex h-full w-full">
      <div className={cn('min-h-0 flex-1 flex-col border-r', middleClass)}>
        <div className="bg-base text-subtle flex h-8 items-center justify-end border-b px-3 text-xs">
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

      <div className={cn('min-h-0 flex-1 flex-col', readerClass)}>
        <div className="bg-base text-subtle relative flex h-8 items-center justify-between border-b px-3 text-xs">
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
          <ComicStrip
            key={comicId}
            ref={stripRef}
            className="h-0 flex-auto"
            comicId={comicId}
            images={images}
            initialIndex={currentIndex}
            orientation="vertical"
            overscanViewports={4}
            maxRenderedPages={32}
            onCurrentIndexChange={handleStripIndexChange}
            onDoubleClick={setPreviewIndex}
            onContextMenu={handleImageClick}
            onTags={updateComicImageTags}
          />
        )}
      </div>

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
