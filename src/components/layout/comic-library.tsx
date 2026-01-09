import {
  Funnel,
  Grid2x2,
  PanelLeftClose,
  PanelLeftOpen,
  Rows2,
  StepForward,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TagButtons } from '@/components/ui/tag-buttons'
import { useCollapse } from '@/hooks/use-collapse'
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

interface ImageItemProps {
  image: Image
  onClick: (index: number) => void
  onTags: (image: Image, tags: FileTags) => void
}

const ImageItem = memo(function ImageItem({
  image,
  onClick,
  onTags,
}: ImageItemProps) {
  return (
    <div
      className={cn(
        'flex w-[128px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all',
        image.deleted && 'opacity-40',
        image.starred ? 'bg-love/50' : 'hover:bg-overlay',
      )}
      onClick={() => onClick(image.index)}
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
          onStar={(e) => {
            e.stopPropagation()
            void onTags(image, { starred: !image.starred })
          }}
          onDelete={(e) => {
            e.stopPropagation()
            void onTags(image, { deleted: !image.deleted })
          }}
          size="sm"
        />
      </div>
      <div className="truncate text-center text-sm transition-colors">
        {image.filename}
      </div>
    </div>
  )
})

const ScrollImageItem = memo(function ScrollImageItem({
  image,
  onClick,
  onTags,
}: ImageItemProps) {
  return (
    <div
      className={cn('relative cursor-pointer', image.deleted && 'opacity-40')}
      onClick={() => onClick(image.index)}
    >
      <img src={image.url} alt={image.filename} className="w-full" />
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

interface ComicItemProps {
  comic: Comic
  isSelected: boolean
  progress?: { percent: number }
  onClick: (id: string) => void
  onTags: (comic: Comic, tags: FileTags) => void
}

const ComicItem = memo(function ComicItem({
  comic,
  isSelected,
  progress,
  onClick,
  onTags,
}: ComicItemProps) {
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
          onStar={(e) => {
            e.stopPropagation()
            void onTags(comic, { starred: !comic.starred })
          }}
          onDelete={(e) => {
            e.stopPropagation()
            void onTags(comic, { deleted: !comic.deleted })
          }}
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

const EMPTY_ARRAY: Image[] = []

export const ComicLibrary = memo(function ComicLibrary({
  selectedLibrary,
}: ComicLibraryProps) {
  const { collapsed, setCollapsed } = useCollapse()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filterComic, setFilterComic] = useState<boolean>(false)
  const [filterImage, setFilterImage] = useState<boolean>(false)

  const updateLibrary = useLibraryStore((s) => s.updateLibrary)
  const updateComicTags = useLibraryStore((s) => s.updateComicTags)
  const updateComicImageTags = useLibraryStore((s) => s.updateComicImageTags)
  const getComicImages = useLibraryStore((s) => s.getComicImages)

  const updateComicProgress = useProgressStore((s) => s.updateComicProgress)
  const activeTab = useTabsStore((s) => s.activeTab)
  const addTab = useTabsStore((s) => s.addTab)
  const setActiveTab = useTabsStore((s) => s.setActiveTab)

  const comicIds = useLibraryStore((s) => s.libraryComics[selectedLibrary.id])
  const comicsMap = useLibraryStore((s) => s.comics)
  const comics = useMemo(
    () => comicIds.map((id) => comicsMap[id]),
    [comicIds, comicsMap],
  )

  const comicProgress = useProgressStore(useShallow((s) => s.comics))

  const { comicId } = selectedLibrary.status
  const comic = useLibraryStore((s) => (comicId ? s.comics[comicId] : null))
  const images = useLibraryStore(
    (s) => s.comicImages[comicId ?? '']?.images ?? EMPTY_ARRAY,
  )

  const stateRef = useRef({ activeTab, comic })
  // eslint-disable-next-line react-hooks/refs
  stateRef.current = { activeTab, comic }

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'grid' ? 'scroll' : 'grid'))
  }, [])

  const toggleFilterComic = useCallback(() => {
    setFilterComic((prev) => !prev)
  }, [])

  const toggleFilterImage = useCallback(() => {
    setFilterImage((prev) => !prev)
  }, [])

  useEffect(() => {
    if (activeTab || !comicId) return
    if (images.length === 0) {
      void getComicImages(comicId)
    }
  }, [comicId, getComicImages, activeTab, images.length])

  const handleSetComicTags = useCallback(
    (comic: Comic, tags: FileTags) => {
      void updateComicTags(comic.id, tags)
    },
    [updateComicTags],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation()

      const { activeTab, comic } = stateRef.current
      if (activeTab || !comic) return

      const key = e.key.toUpperCase()
      if (key === 'C') {
        void handleSetComicTags(comic, { deleted: !comic.deleted })
      } else if (key === 'V') {
        void handleSetComicTags(comic, { starred: !comic.starred })
      } else if (key === 'B') {
        toggleViewMode()
      } else if (key === 'F') {
        toggleFilterComic()
      } else if (key === 'G') {
        toggleFilterImage()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSetComicTags, toggleViewMode, toggleFilterComic, toggleFilterImage])

  const handleSetImageTags = useCallback(
    (image: Image, tags: FileTags) => {
      if (!comicId) return
      void updateComicImageTags(comicId, image.filename, tags)
    },
    [updateComicImageTags, comicId],
  )

  const handleSelectComic = useCallback(
    (id: string) => {
      if (id === comicId) return
      updateLibrary(selectedLibrary.id, { status: { comicId: id } })
    },
    [selectedLibrary.id, updateLibrary, comicId],
  )

  const handleImageClick = useCallback(
    (index: number) => {
      if (!comic) return
      updateComicProgress(comic.id, {
        current: index,
        total: images.length,
        percent: (index / (images.length - 1)) * 100,
        lastRead: Date.now(),
      })

      addTab({
        type: LibraryType.comic,
        id: comic.id,
        title: comic.title,
        path: comic.path,
      })
    },
    [comic, images.length, updateComicProgress, addTab],
  )

  const handleContinueReading = useCallback(() => {
    if (!comic || activeTab === comic.path) return
    addTab({
      type: LibraryType.comic,
      id: comic.id,
      title: comic.title,
      path: comic.path,
    })
    setActiveTab(comic.path)
  }, [addTab, activeTab, setActiveTab, comic])

  const renderScrollImageItem = useCallback(
    (_index: number, img: Image) => (
      <ScrollImageItem
        image={img}
        onClick={handleImageClick}
        onTags={handleSetImageTags}
      />
    ),
    [handleImageClick, handleSetImageTags],
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
          collapsed === 0 ? 'w-0 border-none' : 'flex-1',
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
              <Funnel className="h-4 w-4" />
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
        <ScrollArea className="h-0 flex-1">
          <div className="p-4">
            <div className="align-content-start grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] place-items-start gap-3">
              {showComics.map((comic) => (
                <ComicItem
                  key={comic.id}
                  comic={comic}
                  isSelected={comicId === comic.id}
                  progress={comicProgress[comic.id]}
                  onClick={handleSelectComic}
                  onTags={handleSetComicTags}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Right Column: Comic Detail */}
      <div
        className={cn(
          'flex shrink-0 flex-col',
          collapsed === 2 ? 'w-0' : 'flex-1',
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
              <Funnel className="h-4 w-4" />
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
          <ScrollArea className="h-0 flex-1">
            <div className="p-4">
              <div className="align-content-start grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] place-items-start gap-3">
                {showImages.map((img) => (
                  <ImageItem
                    key={img.path}
                    image={img}
                    onClick={handleImageClick}
                    onTags={handleSetImageTags}
                  />
                ))}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <Virtuoso
            key={comicId}
            className="h-full w-full flex-1"
            data={showImages}
            totalCount={showImages.length}
            itemContent={renderScrollImageItem}
            increaseViewportBy={{ top: 0, bottom: 3000 }}
          />
        )}
      </div>
    </div>
  )
})
