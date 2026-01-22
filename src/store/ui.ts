import { create } from 'zustand'
import {
  createJSONStorage,
  persist,
  subscribeWithSelector,
} from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createTauriFileStorage } from '@/lib/storage'

const uiStorage = createTauriFileStorage('ui')

export type ThemeMode = 'light' | 'dark' | 'system'

interface UIState {
  isSidebarCollapsed: boolean
  isImmersive: boolean
  theme: ThemeMode
  toggleSidebar: () => void
  toggleImmersive: () => void
  setTheme: (theme: ThemeMode) => void
}

const applyTheme = (theme: ThemeMode) => {
  const resolvedTheme =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme

  document.documentElement.setAttribute('data-theme', resolvedTheme)
}

export const useUIStore = create<UIState>()(
  subscribeWithSelector(
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

        setTheme: (theme) => set({ theme }),
      })),
      {
        name: 'ui',
        storage: createJSONStorage(() => uiStorage),
        onRehydrateStorage: () => (state) => {
          if (state) {
            applyTheme(state.theme)
          }
        },
      },
    ),
  ),
)

useUIStore.subscribe(
  (state) => state.theme,
  (theme) => applyTheme(theme),
)

window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => {
    if (useUIStore.getState().theme === 'system') {
      applyTheme('system')
    }
  })
