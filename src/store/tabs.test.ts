import { beforeEach, describe, expect, it } from 'vitest'
import { migrateTabsState, useTabsStore } from '@/store/tabs'
import { LibraryType } from '@/types/library'

describe('tabs store', () => {
  beforeEach(() => {
    useTabsStore.setState(useTabsStore.getInitialState(), true)
  })

  it('opens new tabs and activates an existing tab without duplicating it', () => {
    const store = useTabsStore.getState()

    store.addTab({ type: LibraryType.comic, id: 'comic-1', title: 'Comic 1' })
    store.addTab({ type: LibraryType.book, id: 'book-1', title: 'Book 1' })
    store.addTab({ type: LibraryType.comic, id: 'comic-1', title: 'Comic 1' })

    expect(useTabsStore.getState().tabs).toEqual([
      { type: LibraryType.comic, id: 'comic-1', title: 'Comic 1' },
      { type: LibraryType.book, id: 'book-1', title: 'Book 1' },
    ])
    expect(useTabsStore.getState().activeTab).toBe('comic-1')
  })

  it('activates the next readable tab when the active tab is closed', () => {
    const store = useTabsStore.getState()

    store.addTab({ type: LibraryType.comic, id: 'comic-1', title: 'Comic 1' })
    store.addTab({ type: LibraryType.book, id: 'book-1', title: 'Book 1' })
    store.addTab({ type: LibraryType.book, id: 'book-2', title: 'Book 2' })

    store.removeTab('book-1')

    expect(useTabsStore.getState().tabs.map((tab) => tab.id)).toEqual([
      'comic-1',
      'book-2',
    ])
    expect(useTabsStore.getState().activeTab).toBe('book-2')
  })

  it('falls back to the previous tab or no active tab when closing tabs', () => {
    const store = useTabsStore.getState()

    store.addTab({ type: LibraryType.comic, id: 'comic-1', title: 'Comic 1' })
    store.addTab({ type: LibraryType.book, id: 'book-1', title: 'Book 1' })
    store.removeTab('book-1')

    expect(useTabsStore.getState().activeTab).toBe('comic-1')

    store.removeTab('missing-tab')
    store.removeTab('comic-1')

    expect(useTabsStore.getState().tabs).toEqual([])
    expect(useTabsStore.getState().activeTab).toBe('')
  })

  it('sets and clears active tabs directly', () => {
    const store = useTabsStore.getState()

    store.addTab({ type: LibraryType.book, id: 'book-1', title: 'Book 1' })
    store.setActiveTab('custom-tab')
    store.clearAllTabs()

    expect(useTabsStore.getState().tabs).toEqual([])
    expect(useTabsStore.getState().activeTab).toBe('')
  })

  it('migrates legacy persisted tabs by removing unsupported library types', () => {
    expect(migrateTabsState(null)).toBeNull()

    expect(
      migrateTabsState({
        tabs: [
          { type: LibraryType.comic, id: 'comic-1', title: 'Comic 1' },
          { type: 'video', id: 'video-1', title: 'Video 1' },
        ],
        activeTab: 'video-1',
      }),
    ).toEqual({
      tabs: [{ type: LibraryType.comic, id: 'comic-1', title: 'Comic 1' }],
      activeTab: 'comic-1',
    })

    expect(
      migrateTabsState({
        tabs: [{ type: 'video', id: 'video-1', title: 'Video 1' }],
        activeTab: 'video-1',
      }),
    ).toEqual({ tabs: [], activeTab: '' })

    expect(
      migrateTabsState({
        tabs: [{ type: LibraryType.book, id: 'book-1', title: 'Book 1' }],
        activeTab: 'book-1',
      }),
    ).toEqual({
      tabs: [{ type: LibraryType.book, id: 'book-1', title: 'Book 1' }],
      activeTab: 'book-1',
    })
  })
})
