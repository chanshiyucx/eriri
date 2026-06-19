import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import type { ComicStripHandle } from '@/components/ui/comic-strip'
import { useThrottledProgress } from '@/hooks/use-throttled-progress'
import { createComicProgress } from '@/lib/progress'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import type { ComicImageStatus, FileTags, Image } from '@/types/library'

const EMPTY_ARRAY: Image[] = []

type StripRef = RefObject<ComicStripHandle | null>

export type ComicTagTargetPolicy = 'reader' | 'library-grid' | 'library-scroll'

interface UseComicReadingSessionOptions {
  comicId: string
  stripRef: StripRef
  stripVisible: boolean
  tagTargetPolicy: ComicTagTargetPolicy
}

function clampIndex(index: number, total: number) {
  return Math.max(0, Math.min(total - 1, index))
}

function resolveTagTargetImage(
  policy: ComicTagTargetPolicy,
  images: Image[],
  previewIndex: number,
  hoveredIndex: number | null,
  currentIndex: number,
) {
  if (policy === 'reader' && previewIndex >= 0) {
    return images[previewIndex]
  }
  if (policy === 'library-grid') {
    return images[previewIndex]
  }
  return images[hoveredIndex ?? currentIndex]
}

export function useComicReadingSession({
  comicId,
  stripRef,
  stripVisible,
  tagTargetPolicy,
}: UseComicReadingSessionOptions) {
  const comic = useLibraryStore((s) => s.comics[comicId])
  const comicImages = useLibraryStore((s) => s.comicImages[comicId])
  const images = comicImages?.images ?? EMPTY_ARRAY
  const comicImageStatus: ComicImageStatus = comicImages?.status ?? 'idle'
  const comicImageError = comicImages?.error
  const getComicImages = useLibraryStore((s) => s.getComicImages)
  const updateComicImageTags = useLibraryStore((s) => s.updateComicImageTags)

  const updateComicProgress = useProgressStore((s) => s.updateComicProgress)
  const progress = useProgressStore((s) => s.comics[comicId])
  const savedIndex = progress?.current ?? 0

  const [localPosition, setLocalPosition] = useState<{
    comicId: string
    index: number
  } | null>(null)
  const [previewIndex, setPreviewIndex] = useState(-1)
  const currentIndex =
    localPosition?.comicId === comicId ? localPosition.index : savedIndex
  const currentIndexRef = useRef(currentIndex)
  const hoveredIndexRef = useRef<number | null>(null)
  const throttledUpdateProgress = useThrottledProgress(updateComicProgress)

  useLayoutEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  const comicPath = comic?.path
  useEffect(() => {
    if (!comicPath || comicImageStatus !== 'idle') return
    void getComicImages(comicId)
  }, [comicId, comicImageStatus, comicPath, getComicImages])

  useLayoutEffect(() => {
    if (!stripVisible || !images.length) return
    stripRef.current?.jumpTo(currentIndexRef.current)
  }, [comicId, images.length, stripRef, stripVisible])

  const setCurrentIndex = (index: number) => {
    setLocalPosition((prev) =>
      prev?.comicId === comicId && prev.index === index
        ? prev
        : { comicId, index },
    )
  }

  const persistIndex = (index: number) => {
    if (!comic || !images.length) return
    updateComicProgress(comic.id, createComicProgress(index, images.length))
  }

  const jumpTo = (index?: number) => {
    if (!comic || !images.length) return

    const nextIndex = clampIndex(
      index ?? currentIndexRef.current,
      images.length,
    )
    setCurrentIndex(nextIndex)
    persistIndex(nextIndex)
    stripRef.current?.jumpTo(nextIndex)
  }

  const trackStripIndex = (index: number) => {
    if (!comic || !images.length || !stripVisible) return

    setCurrentIndex(index)
    throttledUpdateProgress.current(
      comic.id,
      createComicProgress(index, images.length),
    )
  }

  const setHoveredIndex = (index: number | null) => {
    hoveredIndexRef.current = index
  }

  const getTagTargetImage = () =>
    resolveTagTargetImage(
      tagTargetPolicy,
      images,
      previewIndex,
      hoveredIndexRef.current,
      currentIndex,
    )

  const updateTargetImageTags = (tagsFor: (image: Image) => FileTags) => {
    if (!comic) return

    const targetImage = getTagTargetImage()
    if (!targetImage) return

    void updateComicImageTags(
      comic.id,
      targetImage.filename,
      tagsFor(targetImage),
    )
  }

  const toggleTargetImageDeleted = () => {
    updateTargetImageTags((image) => ({ deleted: !image.deleted }))
  }

  const toggleTargetImageStarred = () => {
    updateTargetImageTags((image) => ({ starred: !image.starred }))
  }

  const closePreview = () => {
    if (previewIndex >= 0 && images.length) {
      const nextIndex = clampIndex(previewIndex, images.length)
      setCurrentIndex(nextIndex)
      persistIndex(nextIndex)
      if (stripVisible) stripRef.current?.jumpTo(nextIndex)
    }
    setPreviewIndex(-1)
  }

  return {
    comic,
    images,
    comicImageStatus,
    comicImageError,
    isReady: comicImageStatus === 'ready',
    isLoadingComicImages: comicImageStatus === 'loading',
    hasComicImages: images.length > 0,
    ensureComicImages: () => getComicImages(comicId),
    currentIndex,
    previewIndex,
    setPreviewIndex,
    jumpTo,
    trackStripIndex,
    setHoveredIndex,
    closePreview,
    updateComicImageTags,
    toggleTargetImageDeleted,
    toggleTargetImageStarred,
  }
}
