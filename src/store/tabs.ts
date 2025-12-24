import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { LibraryType } from '@/types/library'

export interface Tab {
  id: string
  type: LibraryType
  title: string
  path: string
  lastAccessed?: number
  // State persistence
  mode?: 'detail' | 'read'
  scrollPosition?: number // For Detail View
  readingPageIndex?: number // For Reader View
  // Metadata for restoring view
  imageCount?: number
  bookId?: string // redundant with path/type but useful for quick access if needed, though type checking is better
  comicId?: string
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string
  isImmersive: boolean
  maxTabs: number

  addTab: (tab: Tab) => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTabState: (tabId: string, state: Partial<Tab>) => void
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
      maxTabs: 15,

      addTab: (newTab) =>
        set((state) => {
          // STRICT RULE: Unique by Path.
          // If a tab with the same path exists, we must REPLACE it (resetting its state).
          // This implies removing the old one and adding the new one.

          const existingTabIndex = state.tabs.findIndex(
            (t) => t.path === newTab.path,
          )

          let updatedTabs = [...state.tabs]

          if (existingTabIndex !== -1) {
            // Remove existing tab
            updatedTabs.splice(existingTabIndex, 1)
          }

          // Check max tabs limit AFTER removing existing (if any)
          // If we are still at limit, remove the oldest non-active tab
          if (updatedTabs.length >= state.maxTabs) {
            const sortedByAccess = [...updatedTabs]
              .filter((t) => t.id !== state.activeTabId) // Don't remove active tab
              .sort((a, b) => (a.lastAccessed ?? 0) - (b.lastAccessed ?? 0))

            if (sortedByAccess.length > 0) {
              const oldestTab = sortedByAccess[0]
              updatedTabs = updatedTabs.filter((t) => t.id !== oldestTab.id)
            }
          }

          // Add new tab with current timestamp and default 'detail' mode
          const tabToAdd: Tab = {
            ...newTab,
            lastAccessed: Date.now(),
            mode: newTab.mode ?? 'detail', // Default to detail
            scrollPosition: 0,
            readingPageIndex: 0,
          }

          return {
            tabs: [...updatedTabs, tabToAdd],
            activeTabId: tabToAdd.id,
            isImmersive: false, // Reset immersive when adding/switching to new tab
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
            isImmersive:
              state.activeTabId === tabId ? false : state.isImmersive,
          }
        }),

      setActiveTab: (tabId) =>
        set((state) => ({
          activeTabId: tabId,
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, lastAccessed: Date.now() } : t,
          ),
          // We don't reset isImmersive here, we let the restored tab state decide or components handle it.
          // But typically switching tabs exits immersive unless that tab was in immersive mode?
          // For now, let's play safe and disable immersive on switch, unless we persist it.
          // The requirement said "restore state". If "Reading Mode" implies immersive, we might want to restore it.
          // Current implementation in ContentArea handles immersive based on reading mode often.
          isImmersive: false,
        })),

      updateTabState: (tabId, partialState) =>
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, ...partialState } : t,
          ),
        })),

      getActiveTab: () => {
        const state = get()
        if (state.activeTabId === 'home') return null
        return state.tabs.find((t) => t.id === state.activeTabId) ?? null
      },

      clearAllTabs: () =>
        set({ tabs: [], activeTabId: 'home', isImmersive: false }),

      setImmersive: (isImmersive) => set({ isImmersive }),
    }),
    {
      name: 'eriri-tabs-storage',
    },
  ),
)
