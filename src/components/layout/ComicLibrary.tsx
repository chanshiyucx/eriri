import { PanelLeftClose, PanelLeftOpen, Star, StepForward } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { setFileStar } from '@/lib/scanner'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/store/library'
import { useTabsStore } from '@/store/tabs'
import {
  LibraryType,
  type Comic,
  type Image,
  type Library,
} from '@/types/library'

interface ComicItemProps {
  index: number
  comic: Comic
  isSelected: boolean
  onClick: (id: string) => void
  onStar: (comic: Comic) => Promise<void>
}

const ComicItem = memo(
  ({ index, comic, isSelected, onClick, onStar }: ComicItemProps) => {
    return (
      <div
        data-index={index}
        className={cn(
          'group hover:bg-overlay flex w-[128px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all',
          isSelected && 'bg-overlay ring-rose ring-2',
        )}
        onClick={() => void onClick(comic.id)}
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm transition-all">
          <img
            src={comic.cover}
            alt={comic.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />

          <Button
            className="absolute top-1.5 right-1.5 h-6 w-6 bg-transparent hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
              void onStar(comic)
            }}
          >
            <Star
              className={cn(
                'text-love h-5 w-5 opacity-0',
                comic.starred
                  ? 'fill-gold opacity-100'
                  : 'group-hover:opacity-100',
              )}
            />
          </Button>

          {comic.pageCount && (
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-xs text-white">
              <span>{comic.pageCount}P</span>

              {comic.progress && comic.progress.percent > 0 && (
                <span>{Math.round(comic.progress.percent)}%</span>
              )}
            </div>
          )}

          {comic.progress && comic.progress.percent > 0 && (
            <div className="bg-rose/30 absolute inset-x-0 bottom-0 h-1">
              <div
                className="bg-rose h-full"
                style={{
                  width: `${comic.progress.percent}%`,
                }}
              />
            </div>
          )}
        </div>
        <div
          className={cn(
            'truncate text-center text-sm transition-colors',
            isSelected && 'text-rose',
          )}
        >
          {comic.title}
        </div>
      </div>
    )
  },
)

ComicItem.displayName = 'ComicItem'

interface ImageItemProps {
  index: number
  image: Image
  onClick: (index: number) => void
  onStar: (image: Image) => Promise<void>
}

const ImageItem = memo(({ index, image, onClick, onStar }: ImageItemProps) => {
  return (
    <div
      data-index={index}
      className="group hover:bg-overlay flex w-[128px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all"
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

        <Button
          className="absolute top-1.5 right-1.5 h-6 w-6 bg-transparent hover:bg-transparent"
          onClick={(e) => {
            e.stopPropagation()
            void onStar(image)
          }}
        >
          <Star
            className={cn(
              'text-love h-5 w-5 opacity-0',
              image.starred
                ? 'fill-gold opacity-100'
                : 'group-hover:opacity-100',
            )}
          />
        </Button>
      </div>
      <div className="truncate text-center text-sm transition-colors">
        {image.filename}
      </div>
    </div>
  )
})

ImageItem.displayName = 'ImageItem'

interface ComicLibraryProps {
  selectedLibrary: Library
}

export function ComicLibrary({ selectedLibrary }: ComicLibraryProps) {
  const {
    updateLibrary,
    getComicImages,
    findComic,
    updateComicStarred,
    updateComicImageStarred,
    updateComicProgress,
  } = useLibraryStore()
  const { addTab, setActiveTab, activeTab } = useTabsStore()
  const [collapsed, setCollapsed] = useState(1) // 0 1 2
  const [images, setImages] = useState<Image[]>([])

  const { id, comics = [], status = {} } = selectedLibrary ?? {}

  const comic = useMemo(() => {
    if (!selectedLibrary.id || !status.comicId) return null
    return findComic(selectedLibrary.id, status.comicId)
  }, [selectedLibrary.id, status.comicId, findComic])

  const handleSelectComic = useCallback(
    (comicId: string) => {
      if (comicId === status.comicId) return
      updateLibrary(id, { status: { comicId } })
    },
    [id, status.comicId, updateLibrary],
  )

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      if (!status.comicId) return
      setImages([])
      const res = await getComicImages(id, status.comicId)
      if (isMounted) {
        setImages(res)
      }
    }
    void load()
    return () => {
      isMounted = false
    }
  }, [id, status.comicId, getComicImages])

  const handleContinueReading = useCallback(() => {
    if (!comic || activeTab === comic.path) return
    addTab({
      type: LibraryType.comic,
      title: comic.title,
      path: comic.path,
      status: {
        libraryId: id,
        comicId: comic.id,
      },
    })
    setActiveTab(comic.path)
  }, [id, addTab, activeTab, setActiveTab, comic])

  const handleStarComic = useCallback(
    async (comic: Comic) => {
      try {
        const newStarred = !comic.starred
        const isSuccess = await setFileStar(comic.path, newStarred)
        if (isSuccess) {
          updateComicStarred(id, comic.id, newStarred)
        }
      } catch (error) {
        console.error('Failed to star book:', error)
      }
    },
    [id, updateComicStarred],
  )

  const handleStarImage = useCallback(
    async (image: Image) => {
      try {
        const newStarred = !image.starred
        const isSuccess = await setFileStar(image.path, newStarred)
        if (isSuccess) {
          updateComicImageStarred(status.comicId!, image.filename, newStarred)
          setImages((prev) =>
            prev.map((img) =>
              img.filename === image.filename
                ? { ...img, starred: newStarred }
                : img,
            ),
          )
        }
      } catch (error) {
        console.error('Failed to star book:', error)
      }
    },
    [status.comicId, updateComicImageStarred],
  )

  const handleImageClick = useCallback(
    (index: number) => {
      if (!comic) return

      updateComicProgress(id, comic.id, index, images.length)

      if (activeTab !== comic.path) {
        addTab({
          type: LibraryType.comic,
          title: comic.title,
          path: comic.path,
          status: {
            libraryId: id,
            comicId: comic.id,
          },
        })
        setActiveTab(comic.path)
      } else {
        // If already active, just ensure we switch to it (redundant if checking activeTab, but safe)
        setActiveTab(comic.path)
      }
    },
    [
      comic,
      id,
      images.length,
      updateComicProgress,
      activeTab,
      addTab,
      setActiveTab,
    ],
  )

  console.log('Render ComicLibrary', { ...status }, comics.length, comics)

  return (
    <div className="flex h-full w-full divide-x">
      {/* Left Column: Comic List */}
      <div
        className={cn(
          'flex shrink-0 flex-col',
          collapsed === 0 ? 'flex-0 border-none' : 'flex-1',
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
                  isSelected={status.comicId === c.id}
                  onClick={handleSelectComic}
                  onStar={handleStarComic}
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
          collapsed === 2 ? 'flex-0' : 'flex-1',
        )}
      >
        <div className="bg-base text-subtle flex h-8 items-center justify-between border-b px-4 text-xs uppercase">
          <span>Images ({images.length})</span>
          <div className="flex gap-2">
            <Button
              className="h-6 w-6"
              onClick={handleContinueReading}
              title="Continue Reading"
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
                  key={`${img.filename}-${i}`}
                  index={i}
                  image={img}
                  onClick={handleImageClick}
                  onStar={handleStarImage}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
