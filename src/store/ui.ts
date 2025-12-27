import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createIDBStorage } from '@/lib/storage'

export type ThemeMode = 'light' | 'dark' | 'system'

interface UIState {
  isSidebarCollapsed: boolean
  isImmersive: boolean
  theme: ThemeMode
  toggleSidebar: () => void
  toggleImmersive: () => void
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
    immer((set) => ({
      isSidebarCollapsed: false,
      isImmersive: false,
      theme: 'system',

      toggleSidebar: () =>
        set((state) => {
          state.isSidebarCollapsed = !state.isSidebarCollapsed
        }),

      toggleImmersive: () =>
        set((state) => {
          state.isImmersive = !state.isImmersive
        }),

      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
    })),
    {
      name: 'eriri-ui-storage',
      storage: createJSONStorage(() => createIDBStorage()),
    },
  ),
)
