import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createTauriFileStorage } from '@/lib/storage'
import { LibraryType } from '@/types/library'

const tabsStorage = createTauriFileStorage('tabs')

export interface Tab {
  type: LibraryType
  id: string
  title: string
}

interface TabsState {
  tabs: Tab[]
  activeTab: string
  addTab: (tab: Tab) => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  clearAllTabs: () => void
}

export const useTabsStore = create<TabsState>()(
  persist(
    immer((set) => ({
      tabs: [],
      activeTab: '',

      addTab: (newTab) =>
        set((state) => {
          const existingTab = state.tabs.find((t) => t.id === newTab.id)
          if (existingTab) {
            state.activeTab = newTab.id
          } else {
            state.tabs.push(newTab)
            state.activeTab = newTab.id
          }
        }),

      removeTab: (tabId) =>
        set((state) => {
          const targetIndex = state.tabs.findIndex((t) => t.id === tabId)
          if (targetIndex === -1) return

          if (state.activeTab === tabId) {
            const newActiveTab =
              state.tabs[targetIndex + 1] || state.tabs[targetIndex - 1]
            state.activeTab = newActiveTab ? newActiveTab.id : ''
          }

          state.tabs.splice(targetIndex, 1)
        }),

      setActiveTab: (tabId) => set({ activeTab: tabId }),

      clearAllTabs: () => set({ tabs: [], activeTab: '' }),
    })),
    {
      name: 'tabs',
      storage: createJSONStorage(() => tabsStorage),
    },
  ),
)
