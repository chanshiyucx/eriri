import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ComicStrip, type ComicStripHandle } from '@/components/ui/comic-strip'
import { useComicStrip } from '@/hooks/use-comic-strip'
import type { Image } from '@/types/library'

const jumpTo = vi.hoisted(() => vi.fn())
const onScroll = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/use-comic-strip', () => ({ useComicStrip: vi.fn() }))
vi.mock('@/components/ui/image-view', () => ({
  ScrollImage: (props: {
    image: Image
    onDoubleClick?: (index: number) => void
  }) => (
    <button
      type="button"
      data-testid={`page-${props.image.index}`}
      onDoubleClick={() => props.onDoubleClick?.(props.image.index)}
    >
      {props.image.filename}
    </button>
  ),
}))

function image(index: number): Image {
  return {
    path: `/${index}.jpg`,
    url: `/file/${index}`,
    thumbnail: `/thumb/${index}`,
    filename: `${index}.jpg`,
    starred: false,
    deleted: false,
    width: 100,
    height: 200,
    index,
  }
}

describe('ComicStrip component', () => {
  beforeEach(() => {
    vi.mocked(useComicStrip).mockReturnValue({
      containerRef: { current: null },
      jumpTo,
      onScroll,
      visibleRange: { start: 1, end: 2 },
      layout: {
        orientation: 'horizontal',
        containerWidth: 300,
        containerHeight: 200,
        totalSize: 600,
        viewportSize: 300,
        pages: [0, 1, 2].map((index) => ({
          index,
          width: 200,
          height: 200,
          size: 200,
          start: index * 200,
          end: (index + 1) * 200,
          center: index * 200 + 100,
        })),
      },
    })
  })

  it('renders only the visible horizontal pages and exposes jumpTo', () => {
    const ref = createRef<ComicStripHandle>()
    const onHover = vi.fn()
    const onDoubleClick = vi.fn()
    const { container } = render(
      <ComicStrip
        ref={ref}
        comicId="comic-1"
        images={[image(0), image(1), image(2)]}
        onHover={onHover}
        onDoubleClick={onDoubleClick}
        onTags={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.queryByTestId('page-0')).not.toBeInTheDocument()
    expect(screen.getByTestId('page-1').parentElement).toHaveStyle({
      left: '200px',
      width: '200px',
    })
    expect(container.querySelector('.relative')).toHaveStyle({
      width: '600px',
      height: '100%',
    })

    fireEvent.mouseEnter(screen.getByTestId('page-1').parentElement as Element)
    fireEvent.mouseLeave(screen.getByTestId('page-1').parentElement as Element)
    fireEvent.doubleClick(screen.getByTestId('page-1'))
    expect(onHover).toHaveBeenNthCalledWith(1, 1)
    expect(onHover).toHaveBeenNthCalledWith(2, null)
    expect(onDoubleClick).toHaveBeenCalledWith(1)

    ref.current?.jumpTo(2)
    expect(jumpTo).toHaveBeenCalledWith(2)
    fireEvent.scroll(container.firstElementChild!)
    expect(onScroll).toHaveBeenCalledOnce()
  })

  it('positions vertical pages and handles a missing layout', () => {
    const mockedHook = vi.mocked(useComicStrip)
    mockedHook.mockReturnValue({
      containerRef: { current: null },
      jumpTo,
      onScroll,
      visibleRange: { start: 0, end: 0 },
      layout: {
        orientation: 'vertical',
        containerWidth: 100,
        containerHeight: 200,
        totalSize: 300,
        viewportSize: 200,
        pages: [
          {
            index: 0,
            width: 100,
            height: 300,
            size: 300,
            start: 0,
            end: 300,
            center: 150,
          },
        ],
      },
    })
    const { container, rerender } = render(
      <ComicStrip
        comicId="comic-1"
        images={[image(0)]}
        orientation="vertical"
        onTags={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    expect(screen.getByTestId('page-0').parentElement).toHaveStyle({
      top: '0px',
      height: '300px',
    })
    expect(container.querySelector('.relative')).toHaveStyle({
      width: '100%',
      height: '300px',
    })

    mockedHook.mockReturnValue({
      containerRef: { current: null },
      jumpTo,
      onScroll,
      visibleRange: { start: 0, end: 0 },
      layout: null,
    })
    rerender(
      <ComicStrip
        comicId="comic-1"
        images={[image(0)]}
        orientation="vertical"
        onTags={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    expect(screen.queryByTestId('page-0')).not.toBeInTheDocument()
  })
})
