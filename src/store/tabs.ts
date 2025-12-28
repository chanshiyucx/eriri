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
          const existingTab = state.tabs.find((t) => t.path === newTab.path)
          if (existingTab) {
            state.activeTab = newTab.path
          } else {
            state.tabs.push(newTab)
            state.activeTab = newTab.path
          }
        }),

      removeTab: (tabPath) =>
        set((state) => {
          const targetIndex = state.tabs.findIndex((t) => t.path === tabPath)
          if (targetIndex === -1) return

          if (state.activeTab === tabPath) {
            const newActiveTab =
              state.tabs[targetIndex + 1] || state.tabs[targetIndex - 1]
            state.activeTab = newActiveTab ? newActiveTab.path : ''
          }

          state.tabs.splice(targetIndex, 1)
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
