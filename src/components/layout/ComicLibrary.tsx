import { PanelLeftClose, PanelLeftOpen, StepForward } from 'lucide-react'
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { VirtuosoGrid } from 'react-virtuoso'
import { Button } from '@/components/ui/button'
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
}

const ComicItem = memo(
  ({ index, comic, isSelected, onClick }: ComicItemProps) => {
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
          />
          <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-xs text-white">
            <span>{comic.pageCount ?? 0}P</span>

            {comic.progress && comic.progress.percent > 0 && (
              <span>{Math.round(comic.progress.percent)}%</span>
            )}
          </div>

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
            'truncate text-sm transition-colors',
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
  url: string
  thumbnail: string
  filename: string
  onClick: (index: number) => void
}

const ImageItem = memo(
  ({ thumbnail, filename, onClick, index }: ImageItemProps) => {
    return (
      <div
        data-index={index}
        className="group hover:bg-overlay flex w-[128px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all"
        onClick={() => onClick(index)}
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm transition-all">
          <img
            src={thumbnail}
            alt={filename}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="truncate text-sm transition-colors">{filename}</div>
      </div>
    )
  },
)

ImageItem.displayName = 'ImageItem'

const GridList = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ children, className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-wrap justify-start gap-3 p-4!', className)}
    {...props}
  >
    {children}
  </div>
))
GridList.displayName = 'GridList'

const BookFooter = memo(() => <div className="h-32" />)
BookFooter.displayName = 'BookFooter'

const VIRTUOSO_COMPONENTS = {
  Footer: BookFooter,
  List: GridList,
}

interface ComicLibraryProps {
  selectedLibrary: Library
}

export function ComicLibrary({ selectedLibrary }: ComicLibraryProps) {
  const { updateLibrary, getComicImages, findComic } = useLibraryStore()
  const { addTab, setActiveTab, activeTab } = useTabsStore()
  const [collapsed, setCollapsed] = useState(1) // 0 1 2
  // const [isComicListCollapsed, setIsComicListCollapsed] = useState(false)
  // const [isImageListCollapsed, setIsImageListCollapsed] = useState(false)
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
    const load = async () => {
      if (!status.comicId) return
      const images = await getComicImages(id, status.comicId)
      setImages(images)
    }
    void load()
  }, [id, status.comicId, getComicImages])

  const renderComic = useCallback(
    (index: number, comic: Comic) => (
      <ComicItem
        index={index}
        comic={comic}
        isSelected={status.comicId === comic.id}
        onClick={handleSelectComic}
      />
    ),
    [handleSelectComic, status.comicId],
  )

  const renderImage = useCallback(
    (index: number, image: Image) => (
      <ImageItem
        index={index}
        url={image.url}
        thumbnail={image.thumbnail}
        filename={image.filename}
        onClick={() => console.log('Image clicked', index)}
      />
    ),
    [],
  )

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

  console.log('Render ComicLibrary', { ...status }, comics.length, comics)

  return (
    <div className="flex h-full w-full divide-x">
      {/* Left Column: Comic List */}
      <div
        className={cn(
          'flex shrink-0 flex-col overflow-hidden',
          collapsed === 0 ? 'flex-0' : 'flex-1',
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
        <VirtuosoGrid
          className="h-full w-full flex-1"
          data={comics}
          totalCount={comics.length}
          itemContent={renderComic}
          components={VIRTUOSO_COMPONENTS}
          increaseViewportBy={{ top: 400, bottom: 400 }}
        />
      </div>

      {/* Right Column: Comic Detail */}
      <div
        className={cn(
          'flex shrink-0 flex-col overflow-hidden',
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
        <VirtuosoGrid
          className="h-full w-full flex-1"
          data={images}
          totalCount={images.length}
          itemContent={renderImage}
          components={VIRTUOSO_COMPONENTS}
          increaseViewportBy={{ top: 400, bottom: 400 }}
        />
      </div>
    </div>
  )
}
