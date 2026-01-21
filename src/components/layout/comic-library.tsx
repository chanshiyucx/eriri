import {
  Funnel,
  Grid2x2,
  PanelLeftClose,
  PanelLeftOpen,
  Rows2,
  StepForward,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
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
  type FileTags,
  type Image,
  type Library,
} from '@/types/library'

type ViewMode = 'grid' | 'scroll'

interface ImageProps {
  image: Image
  onClick?: (index: number) => void
  onTags: (image: Image, tags: FileTags) => void
}

const GridImage = memo(function GridImage({
  image,
  onClick,
  onTags,
}: ImageProps) {
  return (
    <div
      className={cn(
        'flex w-[128px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all',
        image.deleted && 'opacity-40',
        image.starred ? 'bg-love/50' : 'hover:bg-overlay',
      )}
      onClick={() => onClick?.(image.index)}
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

const ScrollImage = memo(function ScrollImage({ image, onTags }: ImageProps) {
  return (
    <div
      className={cn(
        'relative bg-cover bg-center',
        image.deleted && 'opacity-40',
      )}
      style={{
        aspectRatio: `${image.width} / ${image.height}`,
        backgroundImage: `url(${image.thumbnail})`,
      }}
    >
      <img
        src={image.url}
        alt={image.filename}
        className="h-full w-full object-cover"
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
        size="md"
      />
    </div>
  )
})

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

  const comics = useLibraryStore(
    useShallow((s) => {
      const comicIds = s.libraryComics[selectedLibrary.id]
      return comicIds.map((id) => s.comics[id])
    }),
  )

  const { comicId } = selectedLibrary.status
  const comic = useLibraryStore((s) => (comicId ? s.comics[comicId] : null))
  const images = useLibraryStore(
    (s) => s.comicImages[comicId ?? '']?.images ?? EMPTY_ARRAY,
  )

  const stateRef = useRef({ activeTab, comic, images })

  // eslint-disable-next-line react-hooks/refs
  stateRef.current = { activeTab, comic, images }

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
      path: comic.path,
    })
    setActiveTab(comic.path)
  }, [addTab, setActiveTab])

  useEffect(() => {
    if (activeTab || !comicId || images.length) return
    void getComicImages(comicId)
  }, [comicId, getComicImages, activeTab, images.length])

  const handleSetComicTags = useCallback(
    (comic: Comic, tags: FileTags) => {
      void updateComicTags(comic.id, tags)
    },
    [updateComicTags],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return

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
      } else if (key === 'P') {
        handleContinueReading()
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
    },
    [selectedLibrary.id, updateLibrary],
  )

  const handleImageClick = useCallback(
    (index: number) => {
      const { comic, images } = stateRef.current
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
    [updateComicProgress, addTab],
  )

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
    (_index: number, img: Image) => (
      <ScrollImage image={img} onTags={handleSetImageTags} />
    ),
    [handleSetImageTags],
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
        <VirtuosoGrid
          className="flex-1"
          data={showComics}
          totalCount={showComics.length}
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
          <VirtuosoGrid
            key={comicId}
            className="flex-1"
            data={showImages}
            totalCount={showImages.length}
            itemContent={renderGridImage}
            components={LibraryPadding}
            listClassName="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] place-items-start gap-3 px-4"
            increaseViewportBy={{ top: 0, bottom: 1000 }}
          />
        ) : (
          <Virtuoso
            key={comicId}
            data={showImages}
            totalCount={showImages.length}
            itemContent={renderScrollImage}
            increaseViewportBy={3000}
          />
        )}
      </div>
    </div>
  )
})
