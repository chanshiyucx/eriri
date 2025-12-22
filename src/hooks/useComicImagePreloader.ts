import { useEffect, useState } from 'react'
import { loadComicImageRange } from '@/lib/scanner'

interface ImageData {
  url: string
  filename: string
}

/**
 * Hook for preloading comic images with a sliding window
 * Only loads images around the current page for optimal performance
 */
export function useComicImagePreloader(
  comicPath: string,
  currentIndex: number,
  totalCount: number,
  windowSize = 2,
) {
  const [loadedImages, setLoadedImages] = useState<Map<number, ImageData>>(
    new Map(),
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadRange = async () => {
      setLoading(true)
      try {
        const start = Math.max(0, currentIndex - windowSize)
        const end = Math.min(totalCount - 1, currentIndex + windowSize)
        const count = end - start + 1

        // Load the range
        const images = await loadComicImageRange(comicPath, start, count)

        setLoadedImages((prev) => {
          const newMap = new Map(prev)

          // Add newly loaded images
          images.forEach((img) => {
            newMap.set(img.index, { url: img.url, filename: img.filename })
          })

          // Clean up images outside the extended window (2x windowSize)
          const extendedStart = Math.max(0, currentIndex - windowSize * 2)
          const extendedEnd = Math.min(
            totalCount - 1,
            currentIndex + windowSize * 2,
          )

          for (const key of newMap.keys()) {
            if (key < extendedStart || key > extendedEnd) {
              newMap.delete(key)
            }
          }

          return newMap
        })
      } catch (error) {
        console.error('Failed to preload images:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadRange()
  }, [currentIndex, comicPath, totalCount, windowSize])

  const getCurrentImage = (): ImageData | null => {
    return loadedImages.get(currentIndex) ?? null
  }

  return {
    loadedImages,
    loading,
    getCurrentImage,
  }
}
