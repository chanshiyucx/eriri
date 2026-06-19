import { Grid2x2, Rows2, Star, StepForward, Trash2 } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { VirtuosoGrid } from 'react-virtuoso'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { ComicStrip, type ComicStripHandle } from '@/components/ui/comic-strip'
import { GridItem } from '@/components/ui/grid-item'
import { GridImage, ImagePreviewOverlay } from '@/components/ui/image-view'
import { useComicReadingSession } from '@/hooks/use-comic-reading-session'
import { useNativeOpen } from '@/hooks/use-native-open'
import { usePanelNav } from '@/hooks/use-panel-nav'
import { SHORTCUTS } from '@/lib/shortcuts'
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

  // A starred cover shows a star badge, a deleted one greys out and shows a
  // trash badge; tapping either badge toggles that tag. Right-click opens the
  // comic's folder natively (desktop only).
  return (
    <GridItem
      title={comic.title}
      cover={comic.cover}
      starred={comic.starred}
      deleted={comic.deleted}
      isSelected={isSelected}
      progress={progress}
      onClick={() => {
        onClick(comic.id)
      }}
      onDoubleClick={() => onDoubleClick?.(comic.id)}
      onContextMenu={useNativeOpen(comic.path)}
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
  const { readerVisible, middleClass, readerClass, openReader } = usePanelNav()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const activeTab = useTabsStore((s) => s.activeTab)
  const addTab = useTabsStore((s) => s.addTab)
  const setActiveTab = useTabsStore((s) => s.setActiveTab)

  const setNavStatus = useUIStore((s) => s.setNavStatus)
  const updateComicTags = useLibraryStore((s) => s.updateComicTags)

  const comicId = useUIStore(
    (s) => s.navStatus[selectedLibrary.id]?.comicId ?? '',
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

  const {
    comic,
    images,
    currentIndex,
    previewIndex,
    setPreviewIndex,
    trackStripIndex,
    setHoveredIndex,
    closePreview,
    updateComicImageTags,
    toggleTargetImageDeleted,
    toggleTargetImageStarred,
  } = useComicReadingSession({
    comicId,
    stripRef,
    stripVisible: readerVisible && viewMode === 'scroll',
    tagTargetPolicy: viewMode === 'grid' ? 'library-grid' : 'library-scroll',
  })

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

  const handleStripIndexChange = (index: number) => {
    trackStripIndex(index)
  }

  // Closing the preview syncs the reading position to the page the user flipped
  // to, scrolling the strip there when scroll mode is showing.
  const handlePreviewClose = () => {
    closePreview()
  }

  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (!comic) return
    if (activeTab) return

    switch (e.code) {
      case SHORTCUTS.continueReading:
        handleContinueReading()
        break
      case SHORTCUTS.toggleViewMode:
        toggleViewMode()
        break
      case SHORTCUTS.toggleItemDeleted:
        void updateComicTags(comic.id, { deleted: !comic.deleted })
        break
      case SHORTCUTS.toggleItemStarred:
        void updateComicTags(comic.id, { starred: !comic.starred })
        break
      case SHORTCUTS.toggleImageDeleted:
        toggleTargetImageDeleted()
        break
      case SHORTCUTS.toggleImageStarred:
        toggleTargetImageStarred()
        break
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
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
      tagOnTap
      onDoubleClick={setPreviewIndex}
      onTags={updateComicImageTags}
    />
  )

  return (
    <div className="flex h-full w-full">
      <div className={cn('min-h-0 flex-1 flex-col border-r', middleClass)}>
        <div className="bg-base text-subtle flex h-8 items-center justify-end border-b px-3 text-xs">
          <span>COMICS ({comics.length})</span>
        </div>
        <div aria-label="漫画列表" className="contents">
          <VirtuosoGrid
            className="flex-1"
            data={comics}
            itemContent={renderComicItem}
            listClassName="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))]"
            increaseViewportBy={600}
          />
        </div>
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
            {comic && (
              <>
                <Button
                  className="h-6 w-6"
                  onClick={() =>
                    void updateComicTags(comic.id, { deleted: !comic.deleted })
                  }
                  title="标记删除"
                >
                  <Trash2
                    className={cn('h-4 w-4', comic.deleted && 'text-subtle/40')}
                  />
                </Button>
                <Button
                  className="h-6 w-6"
                  onClick={() =>
                    void updateComicTags(comic.id, { starred: !comic.starred })
                  }
                  title="标记收藏"
                >
                  <Star
                    className={cn(
                      'h-4 w-4',
                      comic.starred && 'text-love fill-gold/80',
                    )}
                  />
                </Button>
              </>
            )}
          </div>

          <h3 className="absolute top-1/2 left-1/2 max-w-[60%] -translate-1/2 truncate text-center">
            {comic?.title}
          </h3>

          <span>
            {currentIndex + 1} / {images.length}
          </span>
        </div>
        {viewMode === 'grid' ? (
          <div aria-label="图片列表" className="contents">
            <VirtuosoGrid
              key={comicId}
              className="flex-1"
              data={images}
              itemContent={renderGridImage}
              listClassName="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))]"
              increaseViewportBy={600}
            />
          </div>
        ) : (
          <ComicStrip
            key={comicId}
            ref={stripRef}
            className="h-0 flex-auto"
            comicId={comicId}
            images={images}
            initialIndex={currentIndex}
            orientation="vertical"
            onCurrentIndexChange={handleStripIndexChange}
            onHover={setHoveredIndex}
            onDoubleClick={setPreviewIndex}
            onTags={updateComicImageTags}
          />
        )}
      </div>

      <ImagePreviewOverlay
        comicId={comicId}
        images={images}
        index={previewIndex}
        onIndexChange={setPreviewIndex}
        onClose={handlePreviewClose}
        onTags={updateComicImageTags}
      />
    </div>
  )
}
