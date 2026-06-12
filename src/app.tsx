import '@/styles/index.css'
import { useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'

function App() {
  useEffect(() => {
    void useLibraryStore.getState().hydrate()
    void useProgressStore.getState().hydrate()

    const refreshCatalog = () => {
      if (document.visibilityState === 'visible') {
        void useLibraryStore.getState().hydrate()
      }
    }
    window.addEventListener('focus', refreshCatalog)
    document.addEventListener('visibilitychange', refreshCatalog)

    // Swallow the browser's default right-click menu app-wide for a native
    // feel; elements with their own onContextMenu (e.g. open-in-folder) still
    // run.
    const blockContextMenu = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', blockContextMenu)

    return () => {
      window.removeEventListener('focus', refreshCatalog)
      document.removeEventListener('visibilitychange', refreshCatalog)
      document.removeEventListener('contextmenu', blockContextMenu)
    }
  }, [])

  return <AppLayout />
}

export default App
