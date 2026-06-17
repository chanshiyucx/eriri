import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ComicReader } from '@/components/layout/comic-reader'
import { useIsPhone } from '@/hooks/use-is-phone'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import type { Image } from '@/types/library'

const jumpTo = vi.hoisted(() => vi.fn())
const throttledProgress = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/use-is-phone', () => ({ useIsPhone: vi.fn() }))
vi.mock('@/hooks/use-throttled-progress', () => ({
  useThrottledProgress: () => ({ current: throttledProgress }),
}))
vi.mock('@/components/ui/comic-strip', async () => {
  const React = await import('react')
  return {
    ComicStrip: React.forwardRef(function MockComicStrip(
      props: {
        orientation: string
        onCurrentIndexChange: (index: number) => void
        onHover: (index: number | null) => void
        onDoubleClick: (index: number) => void
      },
      ref: React.ForwardedRef<{ jumpTo: typeof jumpTo }>,
    ) {
      React.useImperativeHandle(ref, () => ({ jumpTo }))
      return (
        <div data-testid="comic-strip" data-orientation={props.orientation}>
          <button
            type="button"
            onClick={() => {
              props.onCurrentIndexChange(1)
            }}
          >
            strip-index
          </button>
          <button
            type="button"
            onClick={() => {
              props.onHover(1)
            }}
          >
            strip-hover
          </button>
          <button
            type="button"
            onClick={() => {
              props.onDoubleClick(1)
            }}
          >
            strip-preview
          </button>
        </div>
      )
    }),
  }
})
vi.mock('@/components/ui/image-view', () => ({
  GridImage: ({ image }: { image: Image }) => <div>{image.filename}</div>,
  ImagePreviewOverlay: (props: {
    index: number
    onIndexChange: (index: number) => void
    onClose: () => void
  }) => (
    <div data-testid="preview" data-index={props.index}>
      <button
        type="button"
        onClick={() => {
          props.onIndexChange(0)
        }}
      >
        preview-index
      </button>
      <button type="button" onClick={props.onClose}>
        preview-close
      </button>
    </div>
  ),
}))

const comic = {
  id: 'comic-1',
  title: 'Comic One',
  path: '/comics/one',
  cover: '/cover.jpg',
  libraryId: 'library-1',
  starred: false,
  deleted: false,
  createdAt: 1,
}

function image(index: number): Image {
  return {
    path: `/comics/one/${index}.jpg`,
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

describe('ComicReader', () => {
  const updateComicTags = vi.fn().mockResolvedValue(undefined)
  const updateComicImageTags = vi.fn().mockResolvedValue(undefined)
  const getComicImages = vi.fn().mockResolvedValue(undefined)
  const updateComicProgress = vi.fn()

  beforeEach(() => {
    vi.mocked(useIsPhone).mockReturnValue(false)
    useLibraryStore.setState(useLibraryStore.getInitialState(), true)
    useProgressStore.setState(useProgressStore.getInitialState(), true)
    useTabsStore.setState(useTabsStore.getInitialState(), true)
    useUIStore.setState(useUIStore.getInitialState(), true)
    useLibraryStore.setState({
      comics: { 'comic-1': comic },
      comicImages: {
        'comic-1': {
          comicId: 'comic-1',
          images: [image(0), image(1)],
          timestamp: 1,
        },
      },
      updateComicTags,
      updateComicImageTags,
      getComicImages,
    })
    useProgressStore.setState({
      comics: {
        'comic-1': { current: 0, total: 2, percent: 50, lastRead: 1 },
      },
      updateComicProgress,
    })
    useTabsStore.setState({ activeTab: 'comic-1' })
  })

  it('renders nothing for missing comics or pages and loads missing pages', () => {
    useLibraryStore.setState({ comics: {}, comicImages: {} })
    const view = render(<ComicReader comicId="missing" />)
    expect(view.container).toBeEmptyDOMElement()

    act(() => {
      useLibraryStore.setState({ comics: { 'comic-1': comic } })
    })
    view.rerender(<ComicReader comicId="comic-1" />)
    expect(view.container).toBeEmptyDOMElement()
    expect(getComicImages).toHaveBeenCalledWith('comic-1')
  })

  it('renders responsive strips and persists strip progress', () => {
    const view = render(<ComicReader comicId="comic-1" />)
    expect(screen.getByTestId('comic-strip')).toHaveAttribute(
      'data-orientation',
      'horizontal',
    )
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'strip-index' }))
    expect(throttledProgress).toHaveBeenCalledWith(
      'comic-1',
      expect.objectContaining({ current: 1, total: 2 }),
    )

    vi.mocked(useIsPhone).mockReturnValue(true)
    view.rerender(<ComicReader comicId="comic-1" />)
    expect(screen.getByTestId('comic-strip')).toHaveAttribute(
      'data-orientation',
      'vertical',
    )
  })

  it('handles item and hovered-page tag shortcuts for the active tab', () => {
    render(<ComicReader comicId="comic-1" />)

    fireEvent.keyDown(window, { code: 'KeyC' })
    fireEvent.keyDown(window, { code: 'KeyV' })
    expect(updateComicTags).toHaveBeenNthCalledWith(1, 'comic-1', {
      deleted: true,
    })
    expect(updateComicTags).toHaveBeenNthCalledWith(2, 'comic-1', {
      starred: true,
    })

    fireEvent.click(screen.getByRole('button', { name: 'strip-hover' }))
    fireEvent.keyDown(window, { code: 'KeyM' })
    expect(updateComicImageTags).toHaveBeenCalledWith('comic-1', '1.jpg', {
      starred: true,
    })

    fireEvent.keyDown(window, { code: 'KeyN', metaKey: true })
    expect(updateComicImageTags).toHaveBeenCalledOnce()
    act(() => {
      useTabsStore.setState({ activeTab: 'other' })
    })
    fireEvent.keyDown(window, { code: 'KeyN' })
    expect(updateComicImageTags).toHaveBeenCalledOnce()
  })

  it('synchronizes preview position back to the strip on close', () => {
    render(<ComicReader comicId="comic-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'strip-preview' }))
    expect(screen.getByTestId('preview')).toHaveAttribute('data-index', '1')

    fireEvent.click(screen.getByRole('button', { name: 'preview-index' }))
    fireEvent.click(screen.getByRole('button', { name: 'preview-close' }))
    expect(updateComicProgress).toHaveBeenCalledWith(
      'comic-1',
      expect.objectContaining({ current: 0 }),
    )
    expect(jumpTo).toHaveBeenCalledWith(0)
    expect(screen.getByTestId('preview')).toHaveAttribute('data-index', '-1')
  })

  it('toggles comic tags from the toolbar', () => {
    render(<ComicReader comicId="comic-1" />)
    fireEvent.click(screen.getByTitle('标记删除'))
    fireEvent.click(screen.getByTitle('标记收藏'))

    expect(updateComicTags).toHaveBeenCalledTimes(2)
  })
})
