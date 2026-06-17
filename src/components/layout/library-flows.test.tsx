import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BookLibrary } from '@/components/layout/book-library'
import { ComicLibrary } from '@/components/layout/comic-library'
import { Sidebar } from '@/components/layout/sidebar'
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
    <div data-testid="dnd-context">{children}</div>
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
    <div data-testid="sortable-context">{children}</div>
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
    <div data-testid="virtuoso-grid">
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
  ComicStrip: ({
    images,
    onCurrentIndexChange,
  }: {
    images: Image[]
    onCurrentIndexChange?: (index: number) => void
  }) => (
    <div data-testid="comic-strip">
      {images.map((image, index) => (
        <button
          key={image.filename}
          type="button"
          onClick={() => onCurrentIndexChange?.(index)}
        >
          strip:{image.filename}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('@/components/ui/grid-item', () => ({
  GridItem: ({
    title,
    isSelected,
    onClick,
    onDoubleClick,
    onStar,
    onDelete,
  }: {
    title: string
    isSelected?: boolean
    onClick?: () => void
    onDoubleClick?: () => void
    onStar?: () => void
    onDelete?: () => void
  }) => (
    <div data-selected={isSelected ? 'true' : 'false'}>
      <button type="button" onClick={onClick} onDoubleClick={onDoubleClick}>
        {title}
      </button>
      <button type="button" aria-label={`star ${title}`} onClick={onStar}>
        star
      </button>
      <button type="button" aria-label={`delete ${title}`} onClick={onDelete}>
        delete
      </button>
    </div>
  ),
}))

vi.mock('@/components/ui/image-view', () => ({
  GridImage: ({
    comicId,
    image,
    onDoubleClick,
    onTags,
  }: {
    comicId: string
    image: Image
    onDoubleClick?: (index: number) => void
    onTags?: (
      comicId: string,
      filename: string,
      tags: { starred?: boolean },
    ) => void
  }) => (
    <button
      type="button"
      onClick={() =>
        onTags?.(comicId, image.filename, { starred: !image.starred })
      }
      onDoubleClick={() => onDoubleClick?.(image.index)}
    >
      image:{image.filename}
    </button>
  ),
  ImagePreviewOverlay: ({
    images,
    index,
    onClose,
  }: {
    images: Image[]
    index: number
    onClose: () => void
  }) =>
    index >= 0 ? (
      <button type="button" onClick={onClose}>
        preview:{images[index]?.filename}
      </button>
    ) : null,
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

describe('library flow components', () => {
  beforeEach(() => {
    useLibraryStore.setState(useLibraryStore.getInitialState(), true)
    useProgressStore.setState(useProgressStore.getInitialState(), true)
    useTabsStore.setState(useTabsStore.getInitialState(), true)
    useUIStore.setState(useUIStore.getInitialState(), true)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    )
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    vi.stubGlobal('alert', vi.fn())
  })

  it('selects, refreshes and removes libraries from the sidebar', async () => {
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

    const { container } = render(<Sidebar />)

    expect(screen.getByText('Books')).toBeInTheDocument()
    expect(screen.getByText('Comics')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Comics/ }))
    expect(useUIStore.getState().selectedLibraryId).toBe('comics')

    fireEvent.click(screen.getAllByTitle('刷新库')[1])
    await waitFor(() => {
      expect(refreshLibrary).toHaveBeenCalledWith('comics')
    })
    expect(window.confirm).toHaveBeenCalledWith('确认刷新库 "Comics"?')

    fireEvent.click(screen.getAllByTitle('删除库')[0])
    await waitFor(() => {
      expect(removeLibrary).toHaveBeenCalledWith('books')
    })

    expect(container.firstElementChild).toHaveClass('flex')
  })

  it('renders book authors, sorts book states and opens the selected book reader', () => {
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

    expect(screen.getByText('AUTHORS (1)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Writer/ }))

    expect(screen.getByText('BOOKS (3)')).toBeInTheDocument()
    const bookButtons = screen
      .getAllByRole('button')
      .map((button) => button.textContent)
    expect(bookButtons.indexOf('Starred Book')).toBeLessThan(
      bookButtons.indexOf('Normal Book33%'),
    )
    expect(bookButtons.indexOf('Deleted Book')).toBeGreaterThan(
      bookButtons.indexOf('Normal Book33%'),
    )

    fireEvent.click(screen.getByRole('button', { name: /Normal Book/ }))
    expect(useUIStore.getState().navStatus.books).toEqual({
      authorId: 'author',
      bookId: 'normal',
    })
    expect(screen.getByTestId('book-reader')).toHaveTextContent(
      'book-reader:normal',
    )
  })

  it('loads selected comic images and opens the comic as an active tab', async () => {
    const getComicImages = vi.fn().mockResolvedValue([image(0), image(1)])
    const selectedLibrary = library({ id: 'comics', name: 'Comics' })

    useUIStore.setState({ navStatus: { comics: { comicId: 'selected' } } })
    useLibraryStore.setState({
      comics: {
        selected: comic({ id: 'selected', title: 'Selected Comic' }),
      },
      libraryComics: { comics: ['selected'] },
      getComicImages,
    })

    render(<ComicLibrary selectedLibrary={selectedLibrary} />)

    await waitFor(() => {
      expect(getComicImages).toHaveBeenCalledWith('selected')
    })
    expect(screen.getAllByText('Selected Comic')).toHaveLength(2)

    fireEvent.click(screen.getByTitle('继续阅读'))
    expect(useTabsStore.getState().tabs).toEqual([
      { type: LibraryType.comic, id: 'selected', title: 'Selected Comic' },
    ])
    expect(useTabsStore.getState().activeTab).toBe('selected')
  })

  it('handles comic selection, tags, view mode and image preview progress', () => {
    const updateComicTags = vi.fn().mockResolvedValue(undefined)
    const updateComicImageTags = vi.fn().mockResolvedValue(undefined)
    const getComicImages = vi.fn().mockResolvedValue([])
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

    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    const comicButtons = screen
      .getAllByRole('button')
      .map((button) => button.textContent)
    expect(comicButtons.indexOf('Starred Comic')).toBeLessThan(
      comicButtons.indexOf('Normal Comic'),
    )
    expect(comicButtons.indexOf('Deleted Comic')).toBeGreaterThan(
      comicButtons.indexOf('Normal Comic'),
    )

    fireEvent.click(screen.getByTitle('标记收藏'))
    expect(updateComicTags).toHaveBeenCalledWith('normal', { starred: true })

    fireEvent.click(screen.getByText('image:1.jpg'))
    expect(updateComicImageTags).toHaveBeenCalledWith('normal', '1.jpg', {
      starred: true,
    })

    fireEvent.doubleClick(screen.getByText('image:1.jpg'))
    fireEvent.click(screen.getByText('preview:1.jpg'))
    expect(useProgressStore.getState().comics.normal.percent).toBe(100)

    fireEvent.click(screen.getByTitle('原图预览'))
    expect(screen.getByTitle('网格模式')).toBeInTheDocument()
    expect(screen.getByTestId('comic-strip')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Starred Comic' }))
    expect(useUIStore.getState().navStatus.comics.comicId).toBe('starred')
  })
})
