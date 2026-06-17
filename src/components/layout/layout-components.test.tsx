import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LibraryArea } from '@/components/layout/library-area'
import { Mask } from '@/components/layout/mask'
import { TabArea } from '@/components/layout/tab-area'
import { TabNav } from '@/components/layout/tab-nav'
import { ThemeSwitcher } from '@/components/layout/theme-switcher'
import { useLibraryStore } from '@/store/library'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import { LibraryType } from '@/types/library'

vi.mock('@/components/layout/book-library', () => ({
  BookLibrary: ({ selectedLibrary }: { selectedLibrary: { id: string } }) => (
    <div>book-library:{selectedLibrary.id}</div>
  ),
}))
vi.mock('@/components/layout/comic-library', () => ({
  ComicLibrary: ({ selectedLibrary }: { selectedLibrary: { id: string } }) => (
    <div>comic-library:{selectedLibrary.id}</div>
  ),
}))
vi.mock('@/components/layout/book-reader', () => ({
  BookReader: ({ bookId }: { bookId: string }) => (
    <div>book-reader:{bookId}</div>
  ),
}))
vi.mock('@/components/layout/comic-reader', () => ({
  ComicReader: ({ comicId }: { comicId: string }) => (
    <div>comic-reader:{comicId}</div>
  ),
}))

describe('layout components', () => {
  beforeEach(() => {
    useLibraryStore.setState(useLibraryStore.getInitialState(), true)
    useTabsStore.setState(useTabsStore.getInitialState(), true)
    useUIStore.setState(useUIStore.getInitialState(), true)
  })

  it('switches themes and marks the active choice', () => {
    render(<ThemeSwitcher />)

    expect(screen.getByTitle('跟随系统')).toHaveClass('text-love')
    fireEvent.click(screen.getByTitle('深色'))
    expect(useUIStore.getState().theme).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(screen.getByTitle('深色')).toHaveClass('text-love')
  })

  it('reflects scanning state in the global mask', () => {
    const { container } = render(<Mask />)
    expect(container.firstElementChild).toHaveClass('hidden')

    act(() => {
      useUIStore.getState().setIsScanning(true)
    })
    expect(container.firstElementChild).toHaveClass('visible')
  })

  it('renders the selected library type and responsive visibility', () => {
    useLibraryStore.setState({
      libraries: {
        books: {
          id: 'books',
          name: 'Books',
          path: '/books',
          type: LibraryType.book,
          createdAt: 1,
          sortOrder: 0,
        },
        comics: {
          id: 'comics',
          name: 'Comics',
          path: '/comics',
          type: LibraryType.comic,
          createdAt: 2,
          sortOrder: 1,
        },
      },
    })
    const view = render(<LibraryArea />)
    expect(view.container).toBeEmptyDOMElement()

    act(() => {
      useUIStore.setState({ selectedLibraryId: 'books' })
    })
    expect(screen.getByText('book-library:books')).toBeInTheDocument()
    expect(view.container.firstElementChild).toHaveClass('hidden')

    act(() => {
      useUIStore.setState({
        selectedLibraryId: 'comics',
        isSidebarCollapsed: true,
      })
    })
    expect(screen.getByText('comic-library:comics')).toBeInTheDocument()
    expect(view.container.firstElementChild).toHaveClass('block', 'flex-1')
  })

  it('keeps all tab readers mounted and exposes active/immersive state', () => {
    useTabsStore.setState({
      tabs: [
        { type: LibraryType.book, id: 'book-1', title: 'Book' },
        { type: LibraryType.comic, id: 'comic-1', title: 'Comic' },
      ],
      activeTab: 'comic-1',
    })
    useUIStore.setState({ isImmersive: true })
    const { container } = render(<TabArea />)

    expect(screen.getByText('book-reader:book-1').parentElement).toHaveClass(
      'hidden',
    )
    expect(screen.getByText('comic-reader:comic-1').parentElement).toHaveClass(
      'visible',
      'top-0',
    )
    expect(container.children).toHaveLength(2)
  })

  it('selects, closes and navigates tabs through buttons and shortcuts', () => {
    useTabsStore.setState({
      tabs: [
        { type: LibraryType.book, id: 'book-1', title: 'Book' },
        { type: LibraryType.comic, id: 'comic-1', title: 'Comic' },
      ],
      activeTab: '',
    })
    render(<TabNav />)

    fireEvent.click(screen.getByText('Book'))
    expect(useTabsStore.getState().activeTab).toBe('book-1')

    fireEvent.keyDown(window, { code: 'ArrowDown' })
    expect(useTabsStore.getState().activeTab).toBe('comic-1')
    fireEvent.keyDown(window, { code: 'ArrowDown' })
    expect(useTabsStore.getState().activeTab).toBe('')
    fireEvent.keyDown(window, { code: 'ArrowUp' })
    expect(useTabsStore.getState().activeTab).toBe('comic-1')

    fireEvent.keyDown(window, { code: 'Space' })
    expect(useUIStore.getState().isImmersive).toBe(true)
    fireEvent.keyDown(window, { code: 'Space', metaKey: true })
    expect(useUIStore.getState().isImmersive).toBe(true)

    const comicTab = screen.getByText('Comic').parentElement
    fireEvent.click(within(comicTab!).getByRole('button'))
    expect(useTabsStore.getState().tabs.map((tab) => tab.id)).toEqual([
      'book-1',
    ])
  })

  it('returns from an active tab before toggling layout panels', () => {
    useTabsStore.setState({
      tabs: [{ type: LibraryType.book, id: 'book-1', title: 'Book' }],
      activeTab: 'book-1',
    })
    render(<TabNav />)

    fireEvent.click(screen.getAllByTitle('返回主页')[0])
    expect(useTabsStore.getState().activeTab).toBe('')
    expect(useUIStore.getState().isSidebarCollapsed).toBe(false)

    fireEvent.click(screen.getByTitle('折叠/展开左边栏'))
    expect(useUIStore.getState().isSidebarCollapsed).toBe(true)
    fireEvent.keyDown(window, { code: 'KeyD' })
    expect(useUIStore.getState().isMiddleCollapsed).toBe(true)
  })
})
