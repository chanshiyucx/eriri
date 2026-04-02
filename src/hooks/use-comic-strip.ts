import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Image } from '@/types/library'

const DEFAULT_OVERSCAN_VIEWPORTS = 2
const DEFAULT_MAX_RENDERED_PAGES = 16
export type ComicStripOrientation = 'horizontal' | 'vertical'

export interface ComicPageLayout {
  index: number
  width: number
  height: number
  size: number
  start: number
  end: number
  center: number
}

export interface ComicStripLayout {
  orientation: ComicStripOrientation
  containerWidth: number
  containerHeight: number
  totalSize: number
  viewportSize: number
  pages: ComicPageLayout[]
}

interface VisibleRange {
  start: number
  end: number
}

interface UseComicStripOptions {
  images: Image[]
  initialIndex?: number
  onCurrentIndexChange?: (index: number) => void
  orientation?: ComicStripOrientation
  overscanViewports?: number
  maxRenderedPages?: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function findFirstPageEndingAfter(pages: ComicPageLayout[], value: number) {
  let low = 0
  let high = pages.length - 1
  let result = pages.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (pages[mid].end > value) {
      result = mid
      high = mid - 1
    } else {
      low = mid + 1
    }
  }

  return result
}

function findLastPageStartingBefore(pages: ComicPageLayout[], value: number) {
  let low = 0
  let high = pages.length - 1
  let result = 0

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (pages[mid].start < value) {
      result = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return result
}

function createLayout(
  images: Image[],
  containerWidth: number,
  containerHeight: number,
  orientation: ComicStripOrientation,
): ComicStripLayout | null {
  if (!images.length || containerWidth <= 0 || containerHeight <= 0) {
    return null
  }

  let cursor = 0
  const pages = images.map((image, index) => {
    const width =
      orientation === 'horizontal'
        ? Math.max(
            1,
            Math.round(
              (containerHeight * image.width) / Math.max(1, image.height),
            ),
          )
        : containerWidth
    const height =
      orientation === 'vertical'
        ? Math.max(
            1,
            Math.round(
              (containerWidth * image.height) / Math.max(1, image.width),
            ),
          )
        : containerHeight
    const size = orientation === 'horizontal' ? width : height
    const start = cursor
    const end = start + size
    cursor = end

    return {
      index,
      width,
      height,
      size,
      start,
      end,
      center: start + size / 2,
    }
  })

  return {
    orientation,
    containerWidth,
    containerHeight,
    totalSize: cursor,
    viewportSize:
      orientation === 'horizontal' ? containerWidth : containerHeight,
    pages,
  }
}

export function getComicStripCurrentIndex(
  layout: ComicStripLayout,
  scrollOffset: number,
): number {
  const { pages, viewportSize } = layout
  const viewportEnd = scrollOffset + viewportSize
  const startIndex = Math.max(
    0,
    findFirstPageEndingAfter(pages, scrollOffset) - 1,
  )
  let nearestIndex = clamp(startIndex, 0, pages.length - 1)
  let nearestDistance = Number.POSITIVE_INFINITY

  for (
    let index = startIndex;
    index < pages.length && pages[index].start < viewportEnd;
    index += 1
  ) {
    const page = pages[index]
    const visibleWidth =
      Math.min(page.end, viewportEnd) - Math.max(page.start, scrollOffset)
    const visibilityThreshold = Math.min(page.size, viewportSize) * 0.5

    if (visibleWidth >= visibilityThreshold) {
      return index
    }

    const distance = Math.abs(page.center - (scrollOffset + viewportSize / 2))
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  }

  return nearestIndex
}

function getVisibleRange(
  layout: ComicStripLayout,
  scrollOffset: number,
  overscanViewports: number,
  maxRenderedPages: number,
): VisibleRange {
  const overscanPx = layout.viewportSize * overscanViewports
  const visibleStart = Math.max(0, scrollOffset - overscanPx)
  const visibleEnd = Math.min(
    layout.totalSize,
    scrollOffset + layout.viewportSize + overscanPx,
  )

  let start = findFirstPageEndingAfter(layout.pages, visibleStart)
  let end = findLastPageStartingBefore(layout.pages, visibleEnd)

  if (end < start) {
    end = start
  }

  if (end - start + 1 > maxRenderedPages) {
    const center = Math.floor((start + end) / 2)
    const halfWindow = Math.floor(maxRenderedPages / 2)
    start = clamp(
      center - halfWindow,
      0,
      Math.max(0, layout.pages.length - maxRenderedPages),
    )
    end = Math.min(layout.pages.length - 1, start + maxRenderedPages - 1)
  }

  return { start, end }
}

function shouldUpdateVisibleRange(
  currentRange: VisibleRange,
  nextRange: VisibleRange,
) {
  return (
    nextRange.start < currentRange.start || nextRange.end > currentRange.end
  )
}

function getScrollOffset(
  container: HTMLDivElement,
  orientation: ComicStripOrientation,
) {
  return orientation === 'horizontal'
    ? container.scrollLeft
    : container.scrollTop
}

export function useComicStrip({
  images,
  initialIndex = 0,
  onCurrentIndexChange,
  orientation = 'horizontal',
  overscanViewports = DEFAULT_OVERSCAN_VIEWPORTS,
  maxRenderedPages = DEFAULT_MAX_RENDERED_PAGES,
}: UseComicStripOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pendingJumpRef = useRef<number | null>(initialIndex)
  const frameRef = useRef<number | null>(null)
  const pendingScrollOffsetRef = useRef(0)
  const currentIndexRef = useRef(initialIndex)
  const visibleRangeRef = useRef<VisibleRange>({ start: 0, end: 0 })
  const layoutRef = useRef<ComicStripLayout | null>(null)
  const onCurrentIndexChangeRef =
    useRef<UseComicStripOptions['onCurrentIndexChange']>(onCurrentIndexChange)

  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0,
  })
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({
    start: 0,
    end: 0,
  })

  const layout = useMemo(
    () =>
      createLayout(
        images,
        containerSize.width,
        containerSize.height,
        orientation,
      ),
    [containerSize.height, containerSize.width, images, orientation],
  )
  const layoutRestoreKey = `${containerSize.width}x${containerSize.height}:${orientation}:${images
    .map((image) => `${image.width}x${image.height}`)
    .join('|')}`

  useEffect(() => {
    onCurrentIndexChangeRef.current = onCurrentIndexChange
  }, [onCurrentIndexChange])

  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  const flushScrollState = () => {
    frameRef.current = null
    const scrollOffset = pendingScrollOffsetRef.current
    if (!layout) return

    const nextIndex = getComicStripCurrentIndex(layout, scrollOffset)
    if (nextIndex !== currentIndexRef.current) {
      currentIndexRef.current = nextIndex
      onCurrentIndexChangeRef.current?.(nextIndex)
    }

    const nextRange = getVisibleRange(
      layout,
      scrollOffset,
      overscanViewports,
      maxRenderedPages,
    )
    if (shouldUpdateVisibleRange(visibleRangeRef.current, nextRange)) {
      visibleRangeRef.current = nextRange
      setVisibleRange(nextRange)
    }
  }

  const onScroll = () => {
    const container = containerRef.current
    if (!container) return
    const scrollOffset = getScrollOffset(container, orientation)
    pendingScrollOffsetRef.current = scrollOffset
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(flushScrollState)
  }

  const jumpTo = (targetIndex?: number) => {
    if (!images.length) return

    const nextIndex = clamp(
      targetIndex ?? currentIndexRef.current,
      0,
      images.length - 1,
    )
    currentIndexRef.current = nextIndex

    const container = containerRef.current
    if (!container || !layout) {
      pendingJumpRef.current = nextIndex
      return
    }

    const page = layout.pages[nextIndex]
    const viewportSize = layout.viewportSize
    const targetOffset = clamp(
      page.start - (viewportSize - page.size) / 2,
      0,
      Math.max(0, layout.totalSize - viewportSize),
    )

    pendingJumpRef.current = null
    if (orientation === 'horizontal') {
      container.scrollLeft = targetOffset
    } else {
      container.scrollTop = targetOffset
    }

    const nextRange = getVisibleRange(
      layout,
      targetOffset,
      overscanViewports,
      maxRenderedPages,
    )
    visibleRangeRef.current = nextRange
    setVisibleRange(nextRange)
  }

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      setContainerSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      )
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (!images.length) {
      currentIndexRef.current = 0
      visibleRangeRef.current = { start: 0, end: 0 }
      pendingJumpRef.current = 0
      return
    }

    const currentLayout = layoutRef.current
    if (!currentLayout) return

    const targetIndex = pendingJumpRef.current ?? currentIndexRef.current
    const nextIndex = clamp(targetIndex, 0, images.length - 1)
    currentIndexRef.current = nextIndex

    const container = containerRef.current
    if (!container) {
      pendingJumpRef.current = nextIndex
      return
    }

    const page = currentLayout.pages[nextIndex]
    const viewportSize = currentLayout.viewportSize
    const targetOffset = clamp(
      page.start - (viewportSize - page.size) / 2,
      0,
      Math.max(0, currentLayout.totalSize - viewportSize),
    )

    pendingJumpRef.current = null
    if (orientation === 'horizontal') {
      container.scrollLeft = targetOffset
    } else {
      container.scrollTop = targetOffset
    }

    const nextRange = getVisibleRange(
      currentLayout,
      targetOffset,
      overscanViewports,
      maxRenderedPages,
    )
    visibleRangeRef.current = nextRange
    setVisibleRange((prev) =>
      prev.start === nextRange.start && prev.end === nextRange.end
        ? prev
        : nextRange,
    )
  }, [
    images.length,
    layoutRestoreKey,
    maxRenderedPages,
    orientation,
    overscanViewports,
  ])

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  return {
    containerRef,
    jumpTo,
    layout,
    onScroll,
    visibleRange,
  }
}
