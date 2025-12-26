import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

interface UIState {
  isSidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  isImmersive: boolean
  toggleImmersive: () => void
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

// Apply theme helper function
export const applyTheme = (theme: ThemeMode) => {
  if (typeof window === 'undefined') return

  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
      .matches
      ? 'dark'
      : 'light'
    document.documentElement.setAttribute('data-theme', systemTheme)
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) =>
        set({ isSidebarCollapsed: collapsed }),
      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

      isImmersive: false,
      toggleImmersive: () =>
        set((state) => ({ isImmersive: !state.isImmersive })),

      theme: 'system',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
    }),
    {
      name: 'eriri-ui-storage',
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        theme: state.theme,
      }),
    },
  ),
)
