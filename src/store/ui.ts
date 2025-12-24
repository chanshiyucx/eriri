import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SortKey = 'name' | 'date'
export type SortOrder = 'asc' | 'desc'

interface UIState {
  isSidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  // Search & Sort
  searchQuery: string
  setSearchQuery: (query: string) => void
  isSearchVisible: boolean
  setIsSearchVisible: (visible: boolean) => void
  sortKey: SortKey
  setSortKey: (key: SortKey) => void
  sortOrder: SortOrder
  setSortOrder: (order: SortOrder) => void
  isSortVisible: boolean
  setIsSortVisible: (visible: boolean) => void
  toggleSort: (key: SortKey) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) =>
        set({ isSidebarCollapsed: collapsed }),
      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

      // Search & Sort defaults
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      isSearchVisible: false,
      setIsSearchVisible: (visible) => set({ isSearchVisible: visible }),
      sortKey: 'name',
      setSortKey: (key) => set({ sortKey: key }),
      sortOrder: 'asc',
      setSortOrder: (order) => set({ sortOrder: order }),
      isSortVisible: false,
      setIsSortVisible: (visible) => set({ isSortVisible: visible }),
      toggleSort: (key) =>
        set((state) => {
          if (state.sortKey === key) {
            return { sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' }
          } else {
            return { sortKey: key, sortOrder: 'asc' }
          }
        }),
    }),
    {
      name: 'eriri-ui-storage',
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        sortKey: state.sortKey,
        sortOrder: state.sortOrder,
      }),
    },
  ),
)
