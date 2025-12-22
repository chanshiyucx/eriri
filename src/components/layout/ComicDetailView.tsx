import { motion } from 'framer-motion'
import { StepForward } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { loadComicImageRange } from '@/lib/scanner'

interface ComicDetailViewProps {
  comicPath: string
  imageCount: number
  currentProgress?: number
  onStartReading: (index: number) => void
}

// Cache for loaded image ranges
const imageCache = new Map<
  string,
  Map<number, { url: string; filename: string }>
>()

function ComicThumbnail({
  comicPath,
  index,
  isCurrentProgress,
  onStartReading,
}: {
  comicPath: string
  index: number
  isCurrentProgress: boolean
  onStartReading: (index: number) => void
}) {
  const [imageData, setImageData] = useState<{
    url: string
    filename: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadImage = async () => {
      // Check cache first
      const comicCache = imageCache.get(comicPath)
      if (comicCache?.has(index)) {
        setImageData(comicCache.get(index)!)
        setLoading(false)
        return
      }

      // Load image with a small buffer around it
      try {
        const images = await loadComicImageRange(comicPath, index, 1)
        if (images.length > 0) {
          const img = images[0]

          // Cache the loaded image
          if (!imageCache.has(comicPath)) {
            imageCache.set(comicPath, new Map())
          }
          imageCache
            .get(comicPath)!
            .set(index, { url: img.url, filename: img.filename })

          setImageData({ url: img.url, filename: img.filename })
        }
      } catch (error) {
        console.error('Failed to load image:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadImage()
  }, [comicPath, index])

  return (
    <div
      className="group flex cursor-pointer flex-col gap-2"
      onClick={() => onStartReading(index)}
    >
      <div className="bg-muted relative aspect-[2/3] w-[128px] overflow-hidden rounded-md shadow-md transition-all group-hover:shadow-lg">
        {loading ? (
          <div className="bg-muted-foreground/10 flex h-full w-full items-center justify-center">
            <div className="text-muted-foreground animate-pulse text-xs">
              Loading...
            </div>
          </div>
        ) : imageData ? (
          <img
            src={imageData.url}
            alt={imageData.filename}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="bg-muted-foreground/10 text-muted-foreground flex h-full w-full items-center justify-center text-xs">
            Failed
          </div>
        )}

        {/* Current Page Overlay */}
        {isCurrentProgress && (
          <div className="border-primary bg-primary/10 absolute inset-0 flex items-center justify-center border-2">
            <StepForward className="text-primary fill-primary h-8 w-8 opacity-50" />
          </div>
        )}
      </div>
      <div
        className="text-foreground/90 truncate text-center text-xs"
        title={imageData?.filename ?? `Page ${index + 1}`}
      >
        {imageData?.filename ?? `Page ${index + 1}`}
      </div>
    </div>
  )
}

export function ComicDetailView({
  comicPath,
  imageCount,
  currentProgress = 0,
  onStartReading,
}: ComicDetailViewProps) {
  return (
    <motion.div
      key="detail"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-full w-full"
    >
      <Virtuoso
        style={{ height: '100%' }}
        totalCount={imageCount}
        overscan={10}
        itemContent={(index) => (
          <div className="p-3">
            <ComicThumbnail
              comicPath={comicPath}
              index={index}
              isCurrentProgress={currentProgress === index}
              onStartReading={onStartReading}
            />
          </div>
        )}
        components={{
          /* eslint-disable react/prop-types */
          List: ({ children, ...props }) => (
            <div
              {...props}
              className="grid grid-cols-[repeat(auto-fill,128px)] justify-center gap-6 pb-4 sm:justify-start"
              style={{ ...props.style, display: 'grid' }}
            >
              {children}
            </div>
          ),
          /* eslint-enable react/prop-types */
        }}
      />
    </motion.div>
  )
}
