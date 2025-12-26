import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { LibraryType } from '@/types/library'

export interface Tab {
  type: LibraryType
  title: string
  path: string
  status: {
    libraryId: string
    comicId?: string
    authorId?: string
    bookId?: string
  }
}

interface TabsState {
  tabs: Tab[]
  activeTab: string
  addTab: (tab: Tab) => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  getActiveTab: () => Tab | null
  clearAllTabs: () => void
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTab: '',
      addTab: (newTab) =>
        set((state) => {
          const existingTabIndex = state.tabs.findIndex(
            (t) => t.path === newTab.path,
          )
          const updatedTabs = [...state.tabs]

          if (existingTabIndex !== -1) {
            get().setActiveTab(newTab.path)
          } else {
            updatedTabs.push(newTab)
          }
          return {
            tabs: updatedTabs,
          }
        }),

      removeTab: (tabPath) =>
        set((state) => {
          const newTabs = state.tabs.filter((t) => t.path !== tabPath)
          const newActiveTab =
            state.activeTab === tabPath || !newTabs.length
              ? ''
              : state.activeTab

          return {
            tabs: newTabs,
            activeTab: newActiveTab,
          }
        }),

      setActiveTab: (tabPath) =>
        set(() => ({
          activeTab: tabPath,
        })),
      getActiveTab: () => {
        const state = get()
        return state.tabs.find((t) => t.path === state.activeTab) ?? null
      },
      clearAllTabs: () => set({ tabs: [], activeTab: '' }),
    }),
    {
      name: 'eriri-tabs-storage',
    },
  ),
)
