import { useLibraryStore } from '@/store/library'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import { LibraryType } from '@/types/library'
import { BookLibrary } from './book-library'
import { ComicLibrary } from './comic-library'
import { TabContent } from './tab-content'
import { VideoLibrary } from './video-library'

export function ContentArea() {
  const tabs = useTabsStore((s) => s.tabs)
  const activeTab = useTabsStore((s) => s.activeTab)
  const isImmersive = useUIStore((s) => s.isImmersive)
  const selectedLibrary = useLibraryStore((s) =>
    s.selectedLibraryId ? s.libraries[s.selectedLibraryId] : null,
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
          ) : selectedLibrary.type === LibraryType.video ? (
            <VideoLibrary selectedLibrary={selectedLibrary} />
          ) : (
            <ComicLibrary selectedLibrary={selectedLibrary} />
          )}
        </div>
      )}
    </main>
  )
}
