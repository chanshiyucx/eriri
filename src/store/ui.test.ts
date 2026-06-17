import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUIStore } from '@/store/ui'

describe('UI store', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    )
    useUIStore.setState(useUIStore.getInitialState(), true)
    document.documentElement.removeAttribute('data-theme')
  })

  it('applies the selected theme to the document', () => {
    useUIStore.getState().setTheme('dark')

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    useUIStore.getState().setTheme('light')

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('merges and clears per-library navigation status', () => {
    const store = useUIStore.getState()

    store.setNavStatus('library-1', { comicId: 'comic-1' })
    store.setNavStatus('library-1', { bookId: 'book-1' })

    expect(useUIStore.getState().navStatus['library-1']).toEqual({
      comicId: 'comic-1',
      bookId: 'book-1',
    })

    store.clearNavStatus('library-1')

    expect(useUIStore.getState().navStatus['library-1']).toBeUndefined()
  })

  it('toggles panel state and tracks selected library and scanning state', () => {
    const store = useUIStore.getState()

    store.toggleSidebar()
    store.toggleMiddle()
    store.toggleImmersive()
    store.setIsScanning(true)
    store.setSelectedLibraryId('library-1')

    expect(useUIStore.getState()).toMatchObject({
      isSidebarCollapsed: true,
      isMiddleCollapsed: true,
      isImmersive: true,
      isScanning: true,
      selectedLibraryId: 'library-1',
    })

    store.setSidebarCollapsed(false)
    store.setMiddleCollapsed(false)

    expect(useUIStore.getState().isSidebarCollapsed).toBe(false)
    expect(useUIStore.getState().isMiddleCollapsed).toBe(false)
  })

  it('resolves system theme from the current color scheme', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )

    useUIStore.getState().setTheme('light')
    useUIStore.getState().setTheme('system')

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('reapplies the system theme when the color scheme changes', async () => {
    let onColorSchemeChange: (() => void) | undefined
    vi.resetModules()
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: vi.fn((event: string, listener: () => void) => {
          if (event === 'change') onColorSchemeChange = listener
        }),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    )

    const { useUIStore: freshUIStore } = await import('@/store/ui')
    freshUIStore.setState(freshUIStore.getInitialState(), true)
    document.documentElement.setAttribute('data-theme', 'light')

    onColorSchemeChange?.()

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    freshUIStore.getState().setTheme('light')
    onColorSchemeChange?.()

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })
})
