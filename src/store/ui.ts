import { create } from 'zustand'
import {
  createJSONStorage,
  persist,
  subscribeWithSelector,
} from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createServerStorage } from '@/lib/storage'
import type { LibraryNavStatus } from '@/types/library'

const uiStorage = createServerStorage('ui')

export type ThemeMode = 'light' | 'dark' | 'system'

interface UIState {
  isSidebarCollapsed: boolean
  isMiddleCollapsed: boolean
  isImmersive: boolean
  theme: ThemeMode
  isScanning: boolean
  selectedLibraryId: string | null
  navStatus: Record<string, LibraryNavStatus>
  toggleSidebar: () => void
  toggleMiddle: () => void
  setSidebarCollapsed: (value: boolean) => void
  setMiddleCollapsed: (value: boolean) => void
  toggleImmersive: () => void
  setTheme: (theme: ThemeMode) => void
  setIsScanning: (value: boolean) => void
  setSelectedLibraryId: (id: string | null) => void
  setNavStatus: (libraryId: string, status: LibraryNavStatus) => void
  clearNavStatus: (libraryId: string) => void
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
        isMiddleCollapsed: false,
        isImmersive: false,
        theme: 'system',
        isScanning: false,
        selectedLibraryId: null,
        navStatus: {},

        toggleSidebar: () =>
          set((state) => {
            state.isSidebarCollapsed = !state.isSidebarCollapsed
          }),

        toggleMiddle: () =>
          set((state) => {
            state.isMiddleCollapsed = !state.isMiddleCollapsed
          }),

        setSidebarCollapsed: (value) => set({ isSidebarCollapsed: value }),

        setMiddleCollapsed: (value) => set({ isMiddleCollapsed: value }),

        toggleImmersive: () =>
          set((state) => {
            state.isImmersive = !state.isImmersive
          }),

        setTheme: (theme) => set({ theme }),

        setIsScanning: (value) => set({ isScanning: value }),

        setSelectedLibraryId: (id) => set({ selectedLibraryId: id }),

        setNavStatus: (libraryId, status) =>
          set((state) => {
            state.navStatus[libraryId] = {
              ...state.navStatus[libraryId],
              ...status,
            }
          }),

        clearNavStatus: (libraryId) =>
          set((state) => {
            delete state.navStatus[libraryId]
          }),
      })),
      {
        name: 'ui',
        storage: createJSONStorage(() => uiStorage),
        partialize: (state) => ({
          isSidebarCollapsed: state.isSidebarCollapsed,
          isImmersive: state.isImmersive,
          theme: state.theme,
          selectedLibraryId: state.selectedLibraryId,
          navStatus: state.navStatus,
        }),
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
  (theme) => {
    applyTheme(theme)
  },
)

window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => {
    if (useUIStore.getState().theme === 'system') {
      applyTheme('system')
    }
  })
