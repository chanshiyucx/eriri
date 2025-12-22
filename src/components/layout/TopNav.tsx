import { ChevronLeft, ChevronRight, Home, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface TopNavProps extends React.HTMLAttributes<HTMLDivElement> {
  activeTabId: string
  tabs: { id: string; title: string }[]
  onTabChange: (tabId: string) => void
  onTabClose: (tabId: string) => void
}

export function TopNav({
  className,
  activeTabId,
  tabs,
  onTabChange,
  onTabClose,
  ...props
}: TopNavProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  const updateArrowVisibility = () => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollLeft, scrollWidth, clientWidth } = container
    setShowLeftArrow(scrollLeft > 0)
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1)
  }

  useEffect(() => {
    updateArrowVisibility()
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => updateArrowVisibility()
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [tabs])

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return

    const scrollAmount = 200
    const newScrollLeft =
      direction === 'left'
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount

    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth',
    })
  }

  return (
    <div
      className={cn('bg-base flex h-10 items-center border-b px-2', className)}
      {...props}
    >
      {/* Home Tab - Always visible, non-closable */}
      <Button
        variant={activeTabId === 'home' ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onTabChange('home')}
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">Home</span>
      </Button>

      <Separator orientation="vertical" className="mx-2 h-6" />

      {/* Scrollable Comic Tabs Container */}
      <div className="relative flex flex-1 items-center overflow-hidden">
        {/* Left Arrow */}
        {showLeftArrow && (
          <Button
            variant="ghost"
            size="icon"
            className="bg-base absolute left-0 z-10 h-8 w-8 shrink-0"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Tabs Scroll Area */}
        <div
          ref={scrollContainerRef}
          className="scrollbar-hide flex flex-1 items-center gap-1 overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex items-center gap-1 px-1">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={cn(
                  'bg-surface hover:bg-base group flex max-w-[200px] min-w-[150px] shrink-0 items-center gap-2 rounded-md border px-3 py-1 text-sm transition-colors',
                  activeTabId === tab.id && 'bg-muted',
                )}
                onClick={() => onTabChange(tab.id)}
              >
                <span className="flex-1 truncate">{tab.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTabClose(tab.id)
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Arrow */}
        {showRightArrow && (
          <Button
            variant="ghost"
            size="icon"
            className="bg-base absolute right-0 z-10 h-8 w-8 shrink-0"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
