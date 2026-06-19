import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BookReader } from '@/components/layout/book-reader'
import { parseBook } from '@/lib/scanner'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'

const scrollToIndex = vi.hoisted(() => vi.fn())
const lockScroll = vi.hoisted(() => vi.fn())
const throttledProgress = vi.hoisted(() => vi.fn())

vi.mock('@/lib/scanner', () => ({ parseBook: vi.fn() }))
vi.mock('@/hooks/use-scroll-lock', () => ({
  useScrollLock: () => ({ isLock: { current: false }, lockScroll }),
}))
vi.mock('@/hooks/use-throttled-progress', () => ({
  useThrottledProgress: () => ({ current: throttledProgress }),
}))
vi.mock('react-virtuoso', async () => {
  const React = await import('react')
  return {
    Virtuoso: React.forwardRef(function MockVirtuoso(
      props: {
        data: string[]
        itemContent: (index: number, line: string) => React.ReactNode
        rangeChanged: (range: { startIndex: number; endIndex: number }) => void
      },
      ref: React.ForwardedRef<{ scrollToIndex: typeof scrollToIndex }>,
    ) {
      React.useImperativeHandle(ref, () => ({ scrollToIndex }))
      return (
        <div data-testid="virtuoso">
          {props.data.map((line, index) => (
            <React.Fragment key={`${index}-${line}`}>
              {props.itemContent(index, line)}
            </React.Fragment>
          ))}
          <button
            type="button"
            onClick={() => {
              props.rangeChanged({ startIndex: 1, endIndex: 1 })
            }}
          >
            range-change
          </button>
        </div>
      )
    }),
  }
})

const book = {
  id: 'book-1',
  title: 'Book One',
  path: '/books/one.txt',
  authorId: 'author-1',
  libraryId: 'library-1',
  starred: false,
  deleted: false,
  size: 100,
  createdAt: 1,
}

const content = {
  lines: ['Chapter 1', 'Body', 'Chapter 2'],
  chapters: [
    { title: 'Chapter 1', lineIndex: 0 },
    { title: 'Chapter 2', lineIndex: 2 },
  ],
}

describe('BookReader', () => {
  const updateBookTags = vi.fn().mockResolvedValue(undefined)
  const updateBookProgress = vi.fn()
  const toggleChapterFavorite = vi.fn()

  beforeEach(() => {
    useLibraryStore.setState(useLibraryStore.getInitialState(), true)
    useProgressStore.setState(useProgressStore.getInitialState(), true)
    useTabsStore.setState(useTabsStore.getInitialState(), true)
    useLibraryStore.setState({
      books: { 'book-1': book },
      updateBookTags,
    })
    useProgressStore.setState({
      books: {
        'book-1': {
          current: 1,
          total: 3,
          percent: 50,
          lastRead: 1,
          currentChapterTitle: 'Chapter 1',
        },
      },
      favoriteChapters: { 'book-1': [0] },
      updateBookProgress,
      toggleChapterFavorite,
    })
    vi.mocked(parseBook).mockResolvedValue(content)
  })

  it('renders nothing for a missing catalog book', () => {
    useLibraryStore.setState({ books: {} })
    const { container } = render(<BookReader bookId="missing" />)

    expect(container).toBeEmptyDOMElement()
    expect(parseBook).not.toHaveBeenCalled()
  })

  it('shows loading progress and renders parsed lines', async () => {
    let resolveBook: (value: typeof content) => void = () => undefined
    vi.mocked(parseBook).mockImplementation(
      (_path, onProgress) =>
        new Promise((resolve) => {
          resolveBook = resolve
          onProgress?.(42)
        }),
    )

    render(<BookReader bookId="book-1" />)
    expect(await screen.findByText('42%')).toBeInTheDocument()

    act(() => {
      resolveBook(content)
    })
    expect(await screen.findByText('Body')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(parseBook).toHaveBeenCalledWith(
      '/books/one.txt',
      expect.any(Function),
    )
  })

  it('keeps the toolbar title in the flex row so it cannot overlap controls', async () => {
    render(<BookReader bookId="book-1" showReading />)
    await screen.findByText('Body')

    const title = screen.getByRole('heading', { name: 'Chapter 1' })
    expect(title).toHaveClass('min-w-0', 'flex-1', 'truncate')
    expect(title).not.toHaveClass('md:absolute')
    expect(screen.getByTitle('展开目录').parentElement).toHaveClass('shrink-0')
    expect(screen.getByText('50%').parentElement).toHaveClass(
      'shrink-0',
      'whitespace-nowrap',
    )
  })

  it('handles toolbar, chapter, progress and continue-reading actions', async () => {
    render(<BookReader bookId="book-1" showReading />)
    await screen.findByText('Body')

    fireEvent.click(screen.getByTitle('展开目录'))
    fireEvent.click(screen.getAllByTitle('收藏章节')[0])
    expect(toggleChapterFavorite).toHaveBeenCalledWith('book-1', 0)

    fireEvent.click(screen.getAllByText('Chapter 2')[0])
    expect(updateBookProgress).toHaveBeenCalledWith(
      'book-1',
      expect.objectContaining({ current: 2, currentChapterTitle: 'Chapter 2' }),
    )
    expect(scrollToIndex).toHaveBeenCalledWith({ index: 2, align: 'start' })

    fireEvent.click(screen.getByTitle('标记删除'))
    fireEvent.click(screen.getByTitle('标记收藏'))
    expect(updateBookTags).toHaveBeenNthCalledWith(1, 'book-1', {
      deleted: true,
    })
    expect(updateBookTags).toHaveBeenNthCalledWith(2, 'book-1', {
      starred: true,
    })

    fireEvent.click(screen.getByTitle('继续阅读'))
    expect(useTabsStore.getState()).toMatchObject({
      activeTab: 'book-1',
      tabs: [{ id: 'book-1', title: 'Book One', type: 'book' }],
    })

    fireEvent.click(screen.getByRole('button', { name: 'range-change' }))
    expect(throttledProgress).toHaveBeenCalledWith(
      'book-1',
      expect.objectContaining({ current: 1 }),
    )
  })

  it('supports reader shortcuts only while its tab is active', async () => {
    useTabsStore.setState({ activeTab: 'book-1' })
    render(<BookReader bookId="book-1" />)
    await screen.findByText('Body')

    fireEvent.keyDown(window, { code: 'KeyC' })
    fireEvent.keyDown(window, { code: 'KeyV' })
    fireEvent.keyDown(window, { code: 'KeyC', ctrlKey: true })
    expect(updateBookTags).toHaveBeenCalledTimes(2)

    act(() => {
      useTabsStore.setState({ activeTab: 'other' })
    })
    fireEvent.keyDown(window, { code: 'KeyC' })
    expect(updateBookTags).toHaveBeenCalledTimes(2)
  })

  it('contains parse failures and clears the loading state', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(parseBook).mockRejectedValue(new Error('broken book'))
    const { container } = render(<BookReader bookId="book-1" />)

    await vi.waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        'Failed to load book',
        expect.any(Error),
      )
    })
    expect(container.querySelector('.animate-spinner-scale')).toBeNull()
  })
})
