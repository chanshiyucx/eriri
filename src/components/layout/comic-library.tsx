import {
  PanelLeftClose,
  PanelLeftOpen,
  Star,
  StepForward,
  Trash2,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
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
}

const ComicItem = memo(function ComicItem({
  index,
  comic,
  isSelected,
  progress,
}: ComicItemProps) {
  return (
    <div
      data-index={index}
      data-comic-id={comic.id}
      className={cn(
        'group flex w-[128px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all',
        isSelected && 'bg-overlay ring-rose ring-2',
        comic.deleted && 'opacity-40',
        comic.starred ? 'bg-love/50' : 'hover:bg-overlay',
      )}
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
            data-action="star"
            className="h-6 w-6 bg-transparent hover:bg-transparent"
          >
            <Star
              className={cn(
                'text-love h-5 w-5',
                comic.starred && 'fill-gold/80',
              )}
            />
          </Button>

          <Button
            data-action="delete"
            className="h-6 w-6 bg-transparent hover:bg-transparent"
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
}

const ImageItem = memo(function ImageItem({ index, image }: ImageItemProps) {
  return (
    <div
      data-index={index}
      data-image-path={image.path}
      className={cn(
        'group flex w-[128px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all',
        image.deleted && 'opacity-40',
        image.starred ? 'bg-love/50' : 'hover:bg-overlay',
      )}
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
            data-action="star"
            className="h-6 w-6 bg-transparent hover:bg-transparent"
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
            data-action="delete"
            className="h-6 w-6 bg-transparent hover:bg-transparent"
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
  const comic = useLibraryStore((s) => (comicId ? s.comics[comicId] : ''))

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

  const handleComicListClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement

      // Check for action buttons first
      const actionBtn = target.closest('[data-action]')
      if (actionBtn) {
        e.stopPropagation()
        const action = actionBtn.getAttribute('data-action')
        const comicItem = actionBtn.closest('[data-comic-id]')
        const comicIdAttr = comicItem?.getAttribute('data-comic-id')
        if (!comicIdAttr) return

        const targetComic = comics.find((c) => c.id === comicIdAttr)
        if (!targetComic) return

        if (action === 'star') {
          void handleSetComicTags(targetComic, {
            starred: !targetComic.starred,
          })
        } else if (action === 'delete') {
          void handleSetComicTags(targetComic, {
            deleted: !targetComic.deleted,
          })
        }
        return
      }

      // Handle comic selection
      const comicItem = target.closest('[data-comic-id]')
      const clickedComicId = comicItem?.getAttribute('data-comic-id')
      if (clickedComicId && clickedComicId !== comicId) {
        updateLibrary(selectedLibrary.id, {
          status: { comicId: clickedComicId },
        })
      }
    },
    [comics, comicId, selectedLibrary.id, updateLibrary, handleSetComicTags],
  )

  const handleImageListClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement

      // Check for action buttons first
      const actionBtn = target.closest('[data-action]')
      if (actionBtn) {
        e.stopPropagation()
        const action = actionBtn.getAttribute('data-action')
        const imageItem = actionBtn.closest('[data-image-path]')
        const imagePath = imageItem?.getAttribute('data-image-path')
        if (!imagePath) return

        const image = images.find((img) => img.path === imagePath)
        if (!image) return

        if (action === 'star') {
          void handleSetImageTags(image, { starred: !image.starred })
        } else if (action === 'delete') {
          void handleSetImageTags(image, { deleted: !image.deleted })
        }
        return
      }

      // Handle image click
      const imageItem = target.closest('[data-index]')
      const indexAttr = imageItem?.getAttribute('data-index')
      if (indexAttr !== null && comic) {
        const index = Number(indexAttr)
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
      }
    },
    [images, comic, updateComicProgress, addTab, handleSetImageTags],
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
            <div
              className="align-content-start grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] place-items-start gap-3"
              onClick={handleComicListClick}
            >
              {comics.map((c, i) => (
                <ComicItem
                  key={c.id}
                  index={i}
                  comic={c}
                  isSelected={comicId === c.id}
                  progress={comicProgress[c.id]}
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
            <div
              className="align-content-start grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] place-items-start gap-3"
              onClick={handleImageListClick}
            >
              {images.map((img, i) => (
                <ImageItem key={img.path} index={i} image={img} />
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
})
