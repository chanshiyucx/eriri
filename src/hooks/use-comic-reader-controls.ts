import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { ComicStripHandle } from '@/components/ui/comic-strip'
import { useThrottledProgress } from '@/hooks/use-throttled-progress'
import { createComicProgress } from '@/lib/progress'
import type { Comic, ComicProgress, Image } from '@/types/library'

type UpdateComicProgress = (comicId: string, progress: ComicProgress) => void
type StripRef = RefObject<ComicStripHandle | null>

type TagTargetMode = 'preview-first' | 'preview-only' | 'hover-first'

interface UseComicReaderControlsOptions {
  comicId: string
  images: Image[]
  savedIndex: number
  updateComicProgress: UpdateComicProgress
}

function clampIndex(index: number, total: number) {
  return Math.max(0, Math.min(total - 1, index))
}

export function useComicReaderControls({
  comicId,
  images,
  savedIndex,
  updateComicProgress,
}: UseComicReaderControlsOptions) {
  const [position, setPosition] = useState({ comicId, index: savedIndex })
  const [previewIndex, setPreviewIndex] = useState(-1)
  const currentIndex =
    position.comicId === comicId ? position.index : savedIndex
  const currentIndexRef = useRef(currentIndex)
  const hoveredIndexRef = useRef<number | null>(null)
  const throttledUpdateProgress = useThrottledProgress(updateComicProgress)

  useLayoutEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  const setCurrentIndex = (index: number) => {
    setPosition((prev) =>
      prev.comicId === comicId && prev.index === index
        ? prev
        : { comicId, index },
    )
  }

  const persistIndex = (comic: Comic, index: number) => {
    updateComicProgress(comic.id, createComicProgress(index, images.length))
  }

  const jumpTo = (
    comic: Comic | undefined,
    stripRef: StripRef,
    index?: number,
  ) => {
    if (!comic || !images.length) return

    const nextIndex = clampIndex(
      index ?? currentIndexRef.current,
      images.length,
    )
    setCurrentIndex(nextIndex)
    persistIndex(comic, nextIndex)
    stripRef.current?.jumpTo(nextIndex)
  }

  const trackStripIndex = (
    comic: Comic | undefined,
    index: number,
    enabled = true,
  ) => {
    if (!comic || !images.length || !enabled) return

    setCurrentIndex(index)
    throttledUpdateProgress.current(
      comic.id,
      createComicProgress(index, images.length),
    )
  }

  const setHoveredIndex = (index: number | null) => {
    hoveredIndexRef.current = index
  }

  const getTagTargetImage = (mode: TagTargetMode) => {
    if (mode === 'preview-first' && previewIndex >= 0) {
      return images[previewIndex]
    }
    if (mode === 'preview-only') {
      return images[previewIndex]
    }
    return images[hoveredIndexRef.current ?? currentIndex]
  }

  const closePreview = (
    comic: Comic | undefined,
    stripRef: StripRef,
    shouldSyncStrip: boolean,
  ) => {
    if (comic && previewIndex >= 0 && images.length) {
      const nextIndex = clampIndex(previewIndex, images.length)
      setCurrentIndex(nextIndex)
      persistIndex(comic, nextIndex)
      if (shouldSyncStrip) stripRef.current?.jumpTo(nextIndex)
    }
    setPreviewIndex(-1)
  }

  return {
    currentIndex,
    currentIndexRef,
    previewIndex,
    setPreviewIndex,
    jumpTo,
    trackStripIndex,
    setHoveredIndex,
    getTagTargetImage,
    closePreview,
  }
}
