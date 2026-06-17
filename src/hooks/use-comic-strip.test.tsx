import { act, cleanup, render, renderHook } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getComicStripCurrentIndex,
  useComicStrip,
  type ComicStripLayout,
  type ComicStripOrientation,
} from '@/hooks/use-comic-strip'
import type { Image } from '@/types/library'

function image(index: number, width = 100, height = 200): Image {
  return {
    path: `/comic/${index}.jpg`,
    url: `/file/${index}`,
    thumbnail: `/thumb/${index}`,
    filename: `${index}.jpg`,
    starred: false,
    deleted: false,
    width,
    height,
    index,
  }
}

type StripState = ReturnType<typeof useComicStrip>

interface HarnessProps {
  images: Image[]
  initialIndex?: number
  orientation?: ComicStripOrientation
  onIndex?: (index: number) => void
  onState: (state: StripState) => void
  attached?: boolean
}

function Harness({
  images,
  initialIndex,
  orientation,
  onIndex,
  onState,
  attached = true,
}: HarnessProps) {
  const state = useComicStrip({
    images,
    initialIndex,
    orientation,
    onCurrentIndexChange: onIndex,
    overscanViewports: 0,
    maxRenderedPages: 3,
  })
  const { containerRef, onScroll } = state
  useLayoutEffect(() => {
    onState(state)
  }, [onState, state])
  return attached ? (
    <div data-testid="strip" ref={containerRef} onScroll={onScroll} />
  ) : null
}

describe('comic strip layout', () => {
  let resize: (() => void) | undefined
  let frame: FrameRequestCallback | undefined
  const disconnect = vi.fn()
  const cancelAnimationFrame = vi.fn()

  beforeEach(() => {
    resize = undefined
    frame = undefined
    disconnect.mockClear()
    cancelAnimationFrame.mockClear()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback
        }
        observe() {
          return undefined
        }
        disconnect() {
          disconnect()
        }
      },
    )
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frame = callback
      return 7
    })
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('selects a sufficiently visible page or the nearest page center', () => {
    const layout: ComicStripLayout = {
      orientation: 'horizontal',
      containerWidth: 100,
      containerHeight: 100,
      totalSize: 300,
      viewportSize: 100,
      pages: [0, 1, 2].map((index) => ({
        index,
        width: 100,
        height: 100,
        size: 100,
        start: index * 100,
        end: (index + 1) * 100,
        center: index * 100 + 50,
      })),
    }

    expect(getComicStripCurrentIndex(layout, 0)).toBe(0)
    expect(getComicStripCurrentIndex(layout, 75)).toBe(1)

    const gappedLayout = {
      ...layout,
      pages: layout.pages.map((page) => ({
        ...page,
        size: 20,
        end: page.start + 20,
        center: page.start + 10,
      })),
    }
    expect(getComicStripCurrentIndex(gappedLayout, 35)).toBe(1)

    const sparseLayout = {
      ...layout,
      viewportSize: 10,
      pages: [
        { ...layout.pages[0], size: 100, start: 0, end: 1, center: 0 },
        { ...layout.pages[1], size: 100, start: 0.5, end: 1.5, center: 100 },
      ],
    }
    expect(getComicStripCurrentIndex(sparseLayout, 0.75)).toBe(0)
  })

  it('measures horizontal pages, restores the initial index and tracks scroll', () => {
    const onIndex = vi.fn()
    let state: StripState | undefined
    const onState = (next: StripState) => {
      state = next
    }
    const view = render(
      <Harness
        images={Array.from({ length: 8 }, (_, index) => image(index))}
        initialIndex={2}
        onIndex={onIndex}
        onState={onState}
      />,
    )
    const container = view.getByTestId('strip')
    Object.defineProperties(container, {
      clientWidth: { configurable: true, value: 300 },
      clientHeight: { configurable: true, value: 200 },
    })

    act(() => resize?.())

    expect(state?.layout).toMatchObject({
      orientation: 'horizontal',
      totalSize: 800,
      viewportSize: 300,
    })
    expect(container.scrollLeft).toBe(100)
    expect(state?.visibleRange).toEqual({ start: 1, end: 3 })

    act(() => state?.jumpTo(99))
    expect(container.scrollLeft).toBe(500)
    act(() => state?.jumpTo(-1))
    expect(container.scrollLeft).toBe(0)

    container.scrollLeft = 250
    act(() => {
      state?.onScroll()
      state?.onScroll()
    })
    expect(frame).toBeDefined()
    act(() => frame?.(0))
    expect(onIndex).toHaveBeenCalledWith(2)

    act(() => {
      state?.onScroll()
    })
    act(() => frame?.(0))

    view.rerender(
      <Harness
        images={[image(0), image(1)]}
        onState={onState}
        attached={false}
      />,
    )

    view.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('lays out vertical pages and restores the current page after resizing', () => {
    let state: StripState | undefined
    const onState = (next: StripState) => {
      state = next
    }
    const view = render(
      <Harness
        images={[image(0, 100, 200), image(1, 200, 100)]}
        initialIndex={1}
        orientation="vertical"
        onState={onState}
      />,
    )
    const container = view.getByTestId('strip')
    Object.defineProperties(container, {
      clientWidth: { configurable: true, value: 200 },
      clientHeight: { configurable: true, value: 250 },
    })

    act(() => resize?.())

    expect(state?.layout?.pages).toMatchObject([
      { width: 200, height: 400, size: 400 },
      { width: 200, height: 100, size: 100 },
    ])
    expect(container.scrollTop).toBe(250)

    act(() => {
      state?.jumpTo(0)
      state?.onScroll()
    })
    act(() => frame?.(0))

    act(() => resize?.())
    expect(state?.layout?.orientation).toBe('vertical')
    view.unmount()
  })

  it('handles empty images, missing dimensions and pending jumps safely', () => {
    let state: StripState | undefined
    const onState = (next: StripState) => {
      state = next
    }
    const view = render(<Harness images={[]} onState={onState} />)

    expect(state?.layout).toBeNull()
    act(() => {
      state?.jumpTo(1)
      state?.onScroll()
    })
    act(() => frame?.(0))

    view.rerender(<Harness images={[image(0)]} onState={onState} />)
    act(() => state?.jumpTo())
    expect(state?.layout).toBeNull()

    view.unmount()

    const hook = renderHook(() => useComicStrip({ images: [] }))
    act(() => {
      hook.result.current.onScroll()
    })
    hook.unmount()
  })

  it('cancels pending animation frames on unmount', () => {
    let state: StripState | undefined
    const onState = (next: StripState) => {
      state = next
    }
    const view = render(<Harness images={[image(0)]} onState={onState} />)
    const container = view.getByTestId('strip')
    Object.defineProperties(container, {
      clientWidth: { configurable: true, value: 100 },
      clientHeight: { configurable: true, value: 100 },
    })
    act(() => resize?.())
    act(() => state?.onScroll())

    view.unmount()

    expect(cancelAnimationFrame).toHaveBeenCalledWith(7)
  })
})
