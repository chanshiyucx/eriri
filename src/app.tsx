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
    return () => {
      window.removeEventListener('focus', refreshCatalog)
      document.removeEventListener('visibilitychange', refreshCatalog)
    }
  }, [])

  return <AppLayout />
}

export default App
