import {
  PanelLeftClose,
  PanelLeftOpen,
  Star,
  StepForward,
  Trash2,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCollapse } from '@/hooks/use-collapse'
import { setFileTag } from '@/lib/scanner'
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

interface ComicItemProps {
  index: number
  comic: Comic
  isSelected: boolean
  progress?: { percent: number }
  onClick: (id: string) => void
  onTags: (comic: Comic, tags: FileTags) => Promise<void>
}

const ComicItem = memo(function ComicItem({
  index,
  comic,
  isSelected,
  progress,
  onClick,
  onTags,
}: ComicItemProps) {
  return (
    <div
      data-index={index}
      className={cn(
        'group flex w-[128px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all',
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
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />

        <div className="absolute top-1.5 right-1.5 left-1.5 flex justify-between opacity-0 group-hover:opacity-100">
          <Button
            className="h-6 w-6 bg-transparent hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
              void onTags(comic, { starred: !comic.starred })
            }}
          >
            <Star
              className={cn(
                'text-love h-5 w-5',
                comic.starred && 'fill-gold/80',
              )}
            />
          </Button>

          <Button
            className="h-6 w-6 bg-transparent hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
              void onTags(comic, { deleted: !comic.deleted })
            }}
          >
            <Trash2
              className={cn(
                'text-love h-5 w-5',
                comic.deleted && 'fill-gold/80',
              )}
            />
          </Button>
        </div>

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

interface ImageItemProps {
  index: number
  image: Image
  onClick: (index: number) => void
  onTags: (image: Image, tags: FileTags) => Promise<void>
}

const ImageItem = memo(function ImageItem({
  index,
  image,
  onClick,
  onTags,
}: ImageItemProps) {
  return (
    <div
      data-index={index}
      className={cn(
        'group flex w-[128px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all',
        image.deleted && 'opacity-40',
        image.starred ? 'bg-love/50' : 'hover:bg-overlay',
      )}
      onClick={() => onClick(index)}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm transition-all">
        <img
          src={image.thumbnail}
          alt={image.filename}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />

        <div className="absolute top-1.5 right-1.5 left-1.5 flex justify-between">
          <Button
            className="h-6 w-6 bg-transparent hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
              void onTags(image, { starred: !image.starred })
            }}
          >
            <Star
              className={cn(
                'text-love h-5 w-5',
                image.starred
                  ? 'fill-gold'
                  : 'opacity-0 group-hover:opacity-100',
              )}
            />
          </Button>

          <Button
            className="h-6 w-6 bg-transparent hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
              void onTags(image, { deleted: !image.deleted })
            }}
          >
            <Trash2
              className={cn(
                'text-love h-5 w-5',
                image.deleted
                  ? 'fill-gold/80'
                  : 'opacity-0 group-hover:opacity-100',
              )}
            />
          </Button>
        </div>
      </div>
      <div className="truncate text-center text-sm transition-colors">
        {image.filename}
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
  const [images, setImages] = useState<Image[]>([])
  const { collapsed, setCollapsed } = useCollapse()

  const isScanning = useLibraryStore((s) => s.isScanning)
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

  const stateRef = useRef({ activeTab, comic })
  // eslint-disable-next-line react-hooks/refs
  stateRef.current = { activeTab, comic }

  useEffect(() => {
    if (activeTab) return
    let isMounted = true
    const load = async () => {
      if (!comicId) return
      setImages([])
      const res = await getComicImages(comicId)
      if (isMounted) {
        setImages(res)
      }
    }
    void load()
    return () => {
      isMounted = false
    }
  }, [comicId, getComicImages, activeTab, isScanning])

  const handleSetComicTags = useCallback(
    async (comic: Comic, tags: FileTags) => {
      try {
        const isSuccess = await setFileTag(comic.path, tags)
        if (isSuccess) {
          updateComicTags(comic.id, tags)
        }
      } catch (error) {
        console.error('Failed to set comic tags:', error)
      }
    },
    [updateComicTags],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation()

      const { activeTab, comic } = stateRef.current
      if (activeTab || !comic) return

      if (e.key === 'n' || e.key === 'N') {
        void handleSetComicTags(comic, { starred: !comic.starred })
      } else if (e.key === 'j' || e.key === 'J') {
        void handleSetComicTags(comic, { deleted: !comic.deleted })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSetComicTags])

  const handleSetImageTags = useCallback(
    async (image: Image, tags: FileTags) => {
      try {
        if (!comic) return
        const isSuccess = await setFileTag(image.path, tags)
        if (isSuccess) {
          updateComicImageTags(comic.id, image.filename, tags)
          setImages((prev) =>
            prev.map((img) =>
              img.filename === image.filename ? { ...img, ...tags } : img,
            ),
          )
        }
      } catch (error) {
        console.error('Failed to set image tags:', error)
      }
    },
    [updateComicImageTags, comic],
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
          <span>Comics ({comics.length})</span>
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
        <ScrollArea className="h-0 flex-1">
          <div className="p-4">
            <div className="align-content-start grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] place-items-start gap-3">
              {comics.map((c, i) => (
                <ComicItem
                  key={c.id}
                  index={i}
                  comic={c}
                  isSelected={comicId === c.id}
                  progress={comicProgress[c.id]}
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
          <span>Images ({images.length})</span>
          <div className="flex gap-2">
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
        <ScrollArea className="h-0 flex-1">
          <div className="p-4">
            <div className="align-content-start grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] place-items-start gap-3">
              {images.map((img, i) => (
                <ImageItem
                  key={img.path}
                  index={i}
                  image={img}
                  onClick={handleImageClick}
                  onTags={handleSetImageTags}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
})
