import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ComicImage {
  url: string
  filename: string
}

export type TabType = 'comic' | 'book'

export interface BaseTab {
  id: string
  title: string
  type?: TabType // Optional for backward compatibility (default to comic)
  lastAccessed?: number // Timestamp of last access
}

export interface ComicTab extends BaseTab {
  type?: 'comic'
  comicId: string
  path: string // Path to comic directory for lazy loading
  imageCount: number // Total number of images
  // Legacy support - will be removed in migration
  images?: ComicImage[]
}

export interface BookTab extends BaseTab {
  type: 'book'
  bookId: string
  path: string
}

export type Tab = ComicTab | BookTab

interface TabsState {
  tabs: Tab[]
  activeTabId: string // 'home' or comic tab id
  isImmersive: boolean
  maxTabs: number // Maximum number of tabs allowed

  // Actions
  addTab: (tab: Tab) => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  getActiveTab: () => Tab | null
  clearAllTabs: () => void
  setImmersive: (isImmersive: boolean) => void
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: 'home',
      isImmersive: false,
      maxTabs: 15, // Allow up to 15 tabs

      addTab: (tab) =>
        set((state) => {
          // Check if tab already exists
          // We need to check both comicId and bookId
          const existingTab = state.tabs.find((t) => {
            if (tab.type === 'book') {
              return (t as BookTab).bookId === tab.bookId
            } else {
              return (t as ComicTab).comicId === tab.comicId
            }
          })

          if (existingTab) {
            // Just switch to existing tab and update lastAccessed
            return {
              activeTabId: existingTab.id,
              tabs: state.tabs.map((t) =>
                t.id === existingTab.id
                  ? { ...t, lastAccessed: Date.now() }
                  : t,
              ),
            }
          }

          // Check if we've reached the max tabs limit
          let updatedTabs = state.tabs
          if (updatedTabs.length >= state.maxTabs) {
            // Find the oldest non-active tab and remove it
            const sortedByAccess = [...updatedTabs]
              .filter((t) => t.id !== state.activeTabId)
              .sort((a, b) => (a.lastAccessed ?? 0) - (b.lastAccessed ?? 0))
            if (sortedByAccess.length > 0) {
              const oldestTab = sortedByAccess[0]
              updatedTabs = updatedTabs.filter((t) => t.id !== oldestTab.id)
            }
          }

          // Add new tab with lastAccessed timestamp
          return {
            tabs: [...updatedTabs, { ...tab, lastAccessed: Date.now() }],
            activeTabId: tab.id,
          }
        }),

      removeTab: (tabId) =>
        set((state) => {
          const newTabs = state.tabs.filter((t) => t.id !== tabId)
          // If we're closing the active tab, switch to home
          const newActiveTabId =
            state.activeTabId === tabId ? 'home' : state.activeTabId
          return {
            tabs: newTabs,
            activeTabId: newActiveTabId,
          }
        }),

      setActiveTab: (tabId) =>
        set((state) => ({
          activeTabId: tabId,
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, lastAccessed: Date.now() } : t,
          ),
        })),

      getActiveTab: () => {
        const state = get()
        if (state.activeTabId === 'home') return null
        return state.tabs.find((t) => t.id === state.activeTabId) ?? null
      },

      clearAllTabs: () => set({ tabs: [], activeTabId: 'home' }),

      setImmersive: (isImmersive) => set({ isImmersive }),
    }),
    {
      name: 'eriri-tabs-storage',
    },
  ),
)
