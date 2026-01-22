import { memo } from 'react'
import { BookReader } from '@/components/layout/book-reader'
import { ComicReader } from '@/components/layout/comic-reader'
import { VideoPlayer } from '@/components/layout/video-player'
import { cn } from '@/lib/style'
import { useTabsStore, type Tab } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import { LibraryType } from '@/types/library'

interface TabContentProps {
  tab: Tab
  isActive: boolean
  isImmersive: boolean
}

const TabContent = memo(function TabContent({
  tab,
  isActive,
  isImmersive,
}: TabContentProps) {
  const { type, id } = tab

  return (
    <div
      className={cn(
        'bg-surface fixed inset-0 z-100',
        isActive ? 'visible' : 'hidden',
        isImmersive ? 'top-0' : 'top-8',
      )}
    >
      {type === LibraryType.book ? (
        <BookReader bookId={id} />
      ) : type === LibraryType.comic ? (
        <ComicReader comicId={id} />
      ) : (
        <VideoPlayer videoId={id} />
      )}
    </div>
  )
})

export function TabArea() {
  const tabs = useTabsStore((s) => s.tabs)
  const activeTab = useTabsStore((s) => s.activeTab)
  const isImmersive = useUIStore((s) => s.isImmersive)

  return (
    <>
      {tabs.map((tab) => (
        <TabContent
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTab}
          isImmersive={isImmersive}
        />
      ))}
    </>
  )
}
