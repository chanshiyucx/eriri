import { useCallback, useMemo, useState } from 'react'
import type { Image } from '@/types/library'

export type ViewMode = 'single' | 'double'

const shouldPair = (
  img1: Image,
  img2: Image | undefined,
  containerW: number,
  containerH: number,
): boolean => {
  if (!img2) return false
  if (containerW === 0 || containerH === 0) return false

  const scaledW1 = (img1.width / img1.height) * containerH
  const scaledW2 = (img2.width / img2.height) * containerH

  return scaledW1 + scaledW2 <= containerW + 1
}

const getVisibleIndices = (
  startIndex: number,
  images: Image[],
  viewMode: ViewMode,
  containerSize: { width: number; height: number },
): number[] => {
  if (startIndex < 0 || startIndex >= images.length) return []
  if (viewMode === 'single') return [startIndex]

  if (
    shouldPair(
      images[startIndex],
      images[startIndex + 1],
      containerSize.width,
      containerSize.height,
    )
  ) {
    return [startIndex, startIndex + 1]
  }

  return [startIndex]
}

interface UseComicNavigationProps {
  images: Image[]
  viewMode: ViewMode
  containerSize: { width: number; height: number }
  initialIndex?: number
  onIndexChange?: (index: number) => void
}

export function useComicNavigation({
  images,
  viewMode,
  containerSize,
  initialIndex = 0,
  onIndexChange,
}: UseComicNavigationProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  const visibleIndices = useMemo(() => {
    return getVisibleIndices(currentIndex, images, viewMode, containerSize)
  }, [currentIndex, images, viewMode, containerSize])

  const jumpTo = useCallback(
    (index: number) => {
      const newIndex = Math.max(0, Math.min(index, images.length - 1))
      setCurrentIndex(newIndex)
      onIndexChange?.(newIndex)
    },
    [images.length, onIndexChange],
  )

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const currentVisible = getVisibleIndices(
        prev,
        images,
        viewMode,
        containerSize,
      )
      const step = currentVisible.length ?? 1
      const nextIndex = Math.min(prev + step, images.length - 1)
      if (nextIndex !== prev) {
        onIndexChange?.(nextIndex)
      }
      return nextIndex
    })
  }, [images, viewMode, containerSize, onIndexChange])

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev <= 0) return 0

      const candidateIndex = prev - 1

      if (viewMode === 'single') {
        onIndexChange?.(candidateIndex)
        return candidateIndex
      }

      const prevPrevIndex = candidateIndex - 1
      if (prevPrevIndex >= 0) {
        const canPair = shouldPair(
          images[prevPrevIndex],
          images[candidateIndex],
          containerSize.width,
          containerSize.height,
        )
        if (canPair) {
          if (prevPrevIndex !== prev) {
            onIndexChange?.(prevPrevIndex)
          }
          return prevPrevIndex
        }
      }

      if (candidateIndex !== prev) {
        onIndexChange?.(candidateIndex)
      }
      return candidateIndex
    })
  }, [images, viewMode, containerSize, onIndexChange])

  return {
    currentIndex,
    visibleIndices,
    jumpTo,
    goNext,
    goPrev,
  }
}
