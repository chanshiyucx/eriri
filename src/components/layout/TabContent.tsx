import { memo } from 'react'
import { BookReader } from '@/components/layout/BookReader'
import { ComicReader } from '@/components/layout/ComicReader'
import { cn } from '@/lib/utils'
import type { Tab } from '@/store/tabs'
import { LibraryType } from '@/types/library'

interface TabContentProps {
  tab: Tab
  isActive: boolean
  isImmersive: boolean
}

const TabContent = memo(({ tab, isActive, isImmersive }: TabContentProps) => {
  const { type, id } = tab

  console.log('Render TabContent:', type, id)

  return (
    <div
      className={cn(
        'bg-surface fixed inset-0 z-100 w-full',
        isActive ? 'visible' : 'hidden',
        isImmersive ? 'top-0' : 'top-8',
      )}
    >
      {type === LibraryType.book ? (
        <BookReader bookId={id} showToc />
      ) : (
        <ComicReader comicId={id} />
      )}
    </div>
  )
})

TabContent.displayName = 'TabContent'

export { TabContent }
