import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  isSidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  showOnlyInProgress: boolean
  setShowOnlyInProgress: (show: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) =>
        set({ isSidebarCollapsed: collapsed }),
      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      showOnlyInProgress: false,
      setShowOnlyInProgress: (show) => set({ showOnlyInProgress: show }),
    }),
    {
      name: 'eriri-ui-storage',
    },
  ),
)
