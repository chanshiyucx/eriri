import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createIDBStorage } from '@/lib/storage'
import { LibraryType } from '@/types/library'

export interface Tab {
  type: LibraryType
  id: string
  title: string
  path: string
}

interface TabsState {
  tabs: Tab[]
  activeTab: string
  getActiveTab: () => Tab | null
  addTab: (tab: Tab) => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  clearAllTabs: () => void
}

export const useTabsStore = create<TabsState>()(
  persist(
    immer((set, get) => ({
      tabs: [],
      activeTab: '',

      getActiveTab: () => {
        const state = get()
        return state.tabs.find((t) => t.path === state.activeTab) ?? null
      },

      addTab: (newTab) =>
        set((state) => {
          const existingTabIndex = state.tabs.findIndex(
            (t) => t.path === newTab.path,
          )

          if (existingTabIndex !== -1) {
            state.activeTab = newTab.path
          } else {
            state.tabs.push(newTab)
            state.activeTab = newTab.path
          }
        }),

      removeTab: (tabPath) =>
        set((state) => {
          state.tabs = state.tabs.filter((t) => t.path !== tabPath)

          if (state.activeTab === tabPath || state.tabs.length === 0) {
            state.activeTab = ''
          }
        }),

      setActiveTab: (tabPath) => set({ activeTab: tabPath }),

      clearAllTabs: () => set({ tabs: [], activeTab: '' }),
    })),
    {
      name: 'eriri-tabs-storage',
      storage: createJSONStorage(() => createIDBStorage()),
    },
  ),
)
