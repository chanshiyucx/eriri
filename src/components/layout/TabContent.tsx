import { memo } from 'react'
import { BookReader } from '@/components/layout/BookReader'
import { ComicReader } from '@/components/layout/ComicReader'
import { cn } from '@/lib/utils'
import { type Tab } from '@/store/tabs'

interface TabContentProps {
  tab: Tab
  isActive: boolean
  isImmersive: boolean
}

const TabContent = memo(({ tab, isActive, isImmersive }: TabContentProps) => {
  const { libraryId, authorId, bookId, comicId } = tab.status

  console.log('Render TabContent ---', { ...tab.status })

  return (
    <div
      className={cn(
        'bg-surface fixed inset-0 z-100 w-full',
        isActive ? 'visible' : 'hidden',
        isImmersive ? 'top-0' : 'top-8',
      )}
    >
      {authorId && bookId && (
        <BookReader
          libraryId={libraryId}
          authorId={authorId}
          bookId={bookId}
          showToc
        />
      )}

      {comicId && <ComicReader libraryId={libraryId} comicId={comicId} />}
    </div>
  )
})

TabContent.displayName = 'TabContent'

export { TabContent }
