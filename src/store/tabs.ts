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
}

export interface ComicTab extends BaseTab {
  type?: 'comic'
  comicId: string
  images: ComicImage[]
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
            // Just switch to existing tab
            return { activeTabId: existingTab.id }
          }
          // Add new tab and make it active
          return {
            tabs: [...state.tabs, tab],
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

      setActiveTab: (tabId) => set({ activeTabId: tabId }),

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
