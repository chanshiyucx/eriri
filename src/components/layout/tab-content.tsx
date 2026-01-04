import { memo } from 'react'
import { BookReader } from '@/components/layout/book-reader'
import { ComicReader } from '@/components/layout/comic-reader'
import { VideoPlayer } from '@/components/layout/video-player'
import { cn } from '@/lib/style'
import type { Tab } from '@/store/tabs'
import { LibraryType } from '@/types/library'

interface TabContentProps {
  tab: Tab
  isActive: boolean
  isImmersive: boolean
}

const TabContent = memo(({ tab, isActive, isImmersive }: TabContentProps) => {
  const { type, id } = tab

  return (
    <div
      className={cn(
        'bg-surface fixed inset-0 z-100 w-full',
        isActive ? 'visible' : 'hidden',
        isImmersive ? 'top-0' : 'top-8',
      )}
    >
      {type === LibraryType.book ? (
        <BookReader bookId={id} />
      ) : type === LibraryType.video ? (
        <VideoPlayer videoId={id} />
      ) : (
        <ComicReader comicId={id} />
      )}
    </div>
  )
})

TabContent.displayName = 'TabContent'

export { TabContent }
