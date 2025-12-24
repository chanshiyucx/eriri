import { useMemo } from 'react'
import { useLibraryStore } from '@/store/library'
// import { useTabsStore } from '@/store/tabs'
// import { useUIStore } from '@/store/ui'
import { LibraryType } from '@/types/library'
import { BookLibrary } from './BookLibrary'
import { ComicLibrary } from './ComicLibrary'
import { ContentToolbar } from './ContentToolbar'

// import { TabContent } from './TabContent'

export function ContentArea() {
  const { libraries, selectedLibraryId } = useLibraryStore()

  // const { getActiveTab } = useTabsStore()
  // const { showOnlyInProgress } = useUIStore()

  // Derived State
  // const activeTab = getActiveTab()

  const selectedLibrary = useMemo(
    () => libraries.find((l) => l.id === selectedLibraryId),
    [libraries, selectedLibraryId],
  )

  // ... (rest of the file) ...

  return (
    <main className="bg-surface flex h-full flex-1 flex-col">
      <ContentToolbar />

      <div className="flex-1">
        {/* ... */}

        {/* Home / Library View - Render only if NO active tab */}
        {selectedLibrary &&
          (selectedLibrary.type === LibraryType.book ? (
            <BookLibrary />
          ) : (
            <ComicLibrary />
          ))}
      </div>
    </main>
  )
}
