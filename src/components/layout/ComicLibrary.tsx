import { forwardRef, memo, useCallback, useMemo, useState } from 'react'
import { VirtuosoGrid } from 'react-virtuoso'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/store/library'
import type { Comic, Image } from '@/types/library'

interface ComicItemProps {
  index: number
  comic: Comic
  isSelected: boolean
  onClick: (id: string) => Promise<void>
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
  filename: string
  onClick: (index: number) => void
}

const ImageItem = memo(({ url, filename, onClick, index }: ImageItemProps) => {
  return (
    <div
      data-index={index}
      className="group hover:bg-overlay flex w-[128px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all"
      onClick={() => onClick(index)}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm transition-all">
        <img
          src={url}
          alt={filename}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <div className="truncate text-sm transition-colors">{filename}</div>
    </div>
  )
})

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

export function ComicLibrary() {
  const { libraries, selectedLibraryId, updateLibrary, getComicImages } =
    useLibraryStore()

  const [images, setImages] = useState<Image[]>([])

  // const { searchQuery, sortKey, sortOrder } = useUIStore()

  const selectedLibrary = useMemo(
    () => libraries.find((l) => l.id === selectedLibraryId),
    [libraries, selectedLibraryId],
  )

  const { id, comics = [], status = {} } = selectedLibrary ?? {}

  const handleSelectComic = useCallback(
    async (comicId: string) => {
      console.log('handleSelectComic---', comicId)
      if (comicId === status.comicId) return
      updateLibrary(id!, { status: { comicId } })

      // 手动触发扫描
      const images = await getComicImages(id!, comicId)
      console.log('images---', images.length)
      setImages(images)
    },
    [id, status.comicId, updateLibrary, getComicImages],
  )

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
        filename={image.filename}
        onClick={() => console.log('Image clicked', index)}
      />
    ),
    [],
  )

  console.log('comics render---', status.comicId)

  return (
    <div className="flex h-full w-full divide-x">
      {/* Left Column: Comic List */}
      <div className="flex flex-1 shrink-0 flex-col overflow-hidden">
        <div className="bg-base text-subtle border-b px-4 py-2 text-xs uppercase">
          Comics ({comics.length})
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
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="bg-base text-subtle border-b px-4 py-2 text-xs uppercase">
          Images ({images.length})
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
