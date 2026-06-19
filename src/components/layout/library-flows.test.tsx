import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BookLibrary } from '@/components/layout/book-library'
import { ComicLibrary } from '@/components/layout/comic-library'
import {
  reorderLibraryIdsAfterDrag,
  Sidebar,
} from '@/components/layout/sidebar'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import {
  LibraryType,
  type Author,
  type Book,
  type Comic,
  type Image,
  type Library,
} from '@/types/library'

vi.mock('@dnd-kit/core', () => ({
  closestCenter: vi.fn(),
  DndContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}))

vi.mock('@dnd-kit/modifiers', () => ({
  restrictToVerticalAxis: vi.fn(),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
  verticalListSortingStrategy: {},
}))

vi.mock('react-virtuoso', () => ({
  VirtuosoGrid: ({
    data,
    itemContent,
  }: {
    data: unknown[]
    itemContent: (index: number, item: unknown) => React.ReactNode
  }) => (
    <div>
      {data.map((item, index) => (
        <div key={(item as { id?: string; filename?: string }).id ?? index}>
          {itemContent(index, item)}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/layout/book-reader', () => ({
  BookReader: ({ bookId }: { bookId: string }) => (
    <div data-testid="book-reader">book-reader:{bookId}</div>
  ),
}))

vi.mock('@/components/layout/theme-switcher', () => ({
  ThemeSwitcher: () => <div data-testid="theme-switcher" />,
}))

vi.mock('@/components/ui/comic-strip', () => ({
  ComicStrip: ({ images }: { images: Image[] }) => (
    <div data-testid="comic-strip">
      {images.map((image) => (
        <span key={image.filename}>strip:{image.filename}</span>
      ))}
    </div>
  ),
}))

vi.mock('@/hooks/use-native-open', () => ({
  useNativeOpen: () => vi.fn(),
}))

function library(overrides: Partial<Library>): Library {
  return {
    id: 'library',
    name: 'Library',
    path: '/library',
    type: LibraryType.comic,
    createdAt: 1,
    sortOrder: 0,
    ...overrides,
  }
}

function author(overrides: Partial<Author>): Author {
  return {
    id: 'author',
    name: 'Author',
    path: '/author',
    libraryId: 'books',
    bookCount: 0,
    ...overrides,
  }
}

function book(overrides: Partial<Book>): Book {
  return {
    id: 'book',
    title: 'Book',
    path: '/book.txt',
    authorId: 'author',
    libraryId: 'books',
    starred: false,
    deleted: false,
    size: 100,
    createdAt: 1,
    ...overrides,
  }
}

function comic(overrides: Partial<Comic>): Comic {
  return {
    id: 'comic',
    title: 'Comic',
    path: '/comic',
    cover: '/comic/cover.jpg',
    libraryId: 'comics',
    starred: false,
    deleted: false,
    createdAt: 1,
    ...overrides,
  }
}

function image(index: number, overrides: Partial<Image> = {}): Image {
  return {
    path: `/comic/${index}.jpg`,
    url: `/file/${index}`,
    thumbnail: `/thumb/${index}`,
    filename: `${index}.jpg`,
    starred: false,
    deleted: false,
    width: 100,
    height: 200,
    index,
    ...overrides,
  }
}

function texts(elements: HTMLElement[]) {
  return elements.map((element) => element.textContent ?? '')
}

function tap(surface: HTMLElement) {
  fireEvent.pointerDown(surface, { clientX: 10, clientY: 10 })
  fireEvent.pointerUp(surface, { clientX: 10, clientY: 10 })
}

function doubleTap(surface: HTMLElement) {
  tap(surface)
  tap(surface)
}

describe('library flow components', () => {
  beforeEach(() => {
    useLibraryStore.setState(useLibraryStore.getInitialState(), true)
    useProgressStore.setState(useProgressStore.getInitialState(), true)
    useTabsStore.setState(useTabsStore.getInitialState(), true)
    useUIStore.setState(useUIStore.getInitialState(), true)
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    vi.stubGlobal('alert', vi.fn())
  })

  it('derives library order for valid drag transitions only', () => {
    expect(
      reorderLibraryIdsAfterDrag(
        ['books', 'comics', 'archive'],
        'archive',
        'books',
      ),
    ).toEqual(['archive', 'books', 'comics'])
    expect(
      reorderLibraryIdsAfterDrag(['books', 'comics'], 'books', 'books'),
    ).toBeNull()
    expect(
      reorderLibraryIdsAfterDrag(['books', 'comics'], 'missing', 'books'),
    ).toBeNull()
    expect(
      reorderLibraryIdsAfterDrag(['books', 'comics'], 'books', null),
    ).toBeNull()
  })

  it('selects a library and confirms destructive sidebar actions', async () => {
    const refreshLibrary = vi.fn().mockResolvedValue(undefined)
    const removeLibrary = vi.fn().mockResolvedValue(undefined)

    useLibraryStore.setState({
      libraries: {
        comics: library({
          id: 'comics',
          name: 'Comics',
          type: LibraryType.comic,
          sortOrder: 1,
        }),
        books: library({
          id: 'books',
          name: 'Books',
          type: LibraryType.book,
          sortOrder: 0,
        }),
      },
      refreshLibrary,
      removeLibrary,
    })

    render(<Sidebar />)

    const libraryList = screen.getByLabelText('库列表')
    expect(
      texts(within(libraryList).getAllByRole('button')).filter(Boolean),
    ).toEqual(['Books', 'Comics'])

    fireEvent.click(within(libraryList).getByRole('button', { name: 'Comics' }))
    expect(useUIStore.getState().selectedLibraryId).toBe('comics')

    fireEvent.click(
      within(libraryList).getByRole('button', { name: '刷新库 Comics' }),
    )
    await waitFor(() => {
      expect(refreshLibrary).toHaveBeenCalledWith('comics')
    })
    expect(window.confirm).toHaveBeenCalledWith('确认刷新库 "Comics"?')

    fireEvent.click(
      within(libraryList).getByRole('button', { name: '删除库 Books' }),
    )
    await waitFor(() => {
      expect(removeLibrary).toHaveBeenCalledWith('books')
    })
    expect(window.confirm).toHaveBeenCalledWith('确认删除库 "Books"?')
  })

  it('navigates authors, orders books by reader state and opens the reader', () => {
    const selectedLibrary = library({
      id: 'books',
      name: 'Books',
      type: LibraryType.book,
    })

    useLibraryStore.setState({
      authors: {
        author: author({ id: 'author', name: 'Writer', bookCount: 3 }),
      },
      books: {
        normal: book({ id: 'normal', title: 'Normal Book' }),
        starred: book({ id: 'starred', title: 'Starred Book', starred: true }),
        deleted: book({ id: 'deleted', title: 'Deleted Book', deleted: true }),
      },
      libraryAuthors: { books: ['author'] },
      authorBooks: { author: ['normal', 'deleted', 'starred'] },
    })
    useProgressStore.setState({
      books: {
        normal: { current: 1, total: 3, percent: 33, lastRead: 1 },
      },
    })

    render(<BookLibrary selectedLibrary={selectedLibrary} />)

    fireEvent.click(
      within(screen.getByLabelText('作者列表')).getByRole('button', {
        name: /Writer/,
      }),
    )

    const bookList = screen.getByLabelText('书籍列表')
    expect(texts(within(bookList).getAllByRole('button'))).toEqual([
      'Starred Book',
      'Normal Book33%',
      'Deleted Book',
    ])

    fireEvent.click(
      within(bookList).getByRole('button', { name: /Normal Book/ }),
    )
    expect(useUIStore.getState().navStatus.books).toEqual({
      authorId: 'author',
      bookId: 'normal',
    })
    expect(screen.getByTestId('book-reader')).toHaveTextContent(
      'book-reader:normal',
    )
  })

  it('uses real comic cards, image tags, preview progress and tab actions', () => {
    vi.useFakeTimers()

    const getComicImages = vi.fn().mockResolvedValue([])
    const updateComicTags = vi.fn().mockResolvedValue(undefined)
    const updateComicImageTags = vi.fn().mockResolvedValue(undefined)
    const selectedLibrary = library({ id: 'comics', name: 'Comics' })

    useUIStore.setState({ navStatus: { comics: { comicId: 'normal' } } })
    useLibraryStore.setState({
      comics: {
        normal: comic({ id: 'normal', title: 'Normal Comic' }),
        starred: comic({
          id: 'starred',
          title: 'Starred Comic',
          starred: true,
        }),
        deleted: comic({
          id: 'deleted',
          title: 'Deleted Comic',
          deleted: true,
        }),
      },
      libraryComics: { comics: ['normal', 'deleted', 'starred'] },
      comicImages: {
        normal: {
          comicId: 'normal',
          status: 'ready',
          images: [image(0), image(1)],
          timestamp: 1,
        },
      },
      getComicImages,
      updateComicTags,
      updateComicImageTags,
    })
    useProgressStore.setState({
      comics: {
        normal: { current: 1, total: 2, percent: 50, lastRead: 1 },
      },
    })

    render(<ComicLibrary selectedLibrary={selectedLibrary} />)

    expect(
      within(screen.getByLabelText('漫画列表'))
        .getAllByRole('img')
        .map((img) => img.getAttribute('alt')),
    ).toEqual(['Starred Comic', 'Normal Comic', 'Deleted Comic'])
    expect(screen.getAllByText('2 / 2').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByTitle('标记收藏'))
    expect(updateComicTags).toHaveBeenCalledWith('normal', { starred: true })

    const imageFigure = within(screen.getByLabelText('图片列表'))
      .getByRole('img', { name: '1.jpg' })
      .closest('figure')!
    tap(imageFigure)
    act(() => {
      vi.advanceTimersByTime(350)
    })
    fireEvent.click(within(imageFigure).getByLabelText('标记收藏'))
    expect(updateComicImageTags).toHaveBeenCalledWith('normal', '1.jpg', {
      starred: true,
    })

    doubleTap(imageFigure)
    const previewFigure = within(
      screen.getByRole('dialog', { name: '图片预览' }),
    )
      .getByRole('img', { name: '1.jpg' })
      .closest('figure')!
    doubleTap(previewFigure)
    expect(useProgressStore.getState().comics.normal.percent).toBe(100)

    fireEvent.click(screen.getByTitle('原图预览'))
    expect(screen.getByTitle('网格模式')).toBeInTheDocument()
    expect(screen.getByTestId('comic-strip')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('继续阅读'))
    expect(useTabsStore.getState().tabs).toEqual([
      { type: LibraryType.comic, id: 'normal', title: 'Normal Comic' },
    ])
    expect(useTabsStore.getState().activeTab).toBe('normal')

    fireEvent.click(screen.getByRole('img', { name: 'Starred Comic' }))
    expect(useUIStore.getState().navStatus.comics.comicId).toBe('starred')
  })
})
