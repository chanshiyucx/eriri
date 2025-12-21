import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ComicImage {
  url: string
  filename: string
}

export interface ComicTab {
  id: string
  comicId: string
  title: string
  images: ComicImage[]
}

interface TabsState {
  tabs: ComicTab[]
  activeTabId: string // 'home' or comic tab id

  // Actions
  addTab: (tab: ComicTab) => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  getActiveTab: () => ComicTab | null
  clearAllTabs: () => void
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: 'home',

      addTab: (tab) =>
        set((state) => {
          // Check if tab already exists
          const existingTab = state.tabs.find((t) => t.comicId === tab.comicId)
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
    }),
    {
      name: 'eriri-tabs-storage',
    },
  ),
)
