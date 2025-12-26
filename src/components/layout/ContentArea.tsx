import { useMemo } from 'react'
import { useLibraryStore } from '@/store/library'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import { LibraryType } from '@/types/library'
import { BookLibrary } from './BookLibrary'
import { ComicLibrary } from './ComicLibrary'
import { TabContent } from './TabContent'

export function ContentArea() {
  const { libraries, selectedLibraryId } = useLibraryStore()
  const { activeTab, tabs } = useTabsStore()
  const { isImmersive } = useUIStore()

  const selectedLibrary = useMemo(
    () => libraries.find((l) => l.id === selectedLibraryId),
    [libraries, selectedLibraryId],
  )

  return (
    <main className="bg-surface flex h-full flex-1 flex-col">
      {tabs.map((tab) => (
        <TabContent
          key={tab.path}
          tab={tab}
          isActive={tab.path === activeTab}
          isImmersive={isImmersive}
        />
      ))}

      {selectedLibrary && (
        <div className="flex-1">
          {selectedLibrary.type === LibraryType.book ? (
            <BookLibrary selectedLibrary={selectedLibrary} />
          ) : (
            <ComicLibrary selectedLibrary={selectedLibrary} />
          )}
        </div>
      )}
    </main>
  )
}
