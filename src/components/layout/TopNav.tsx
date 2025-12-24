import { ChevronLeft, ChevronRight, Home, X } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTabsStore, type Tab } from '@/store/tabs'

interface TabItemProps {
  tab: Tab
  isActive: boolean
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

const TabItem = memo(({ tab, isActive, onSelect, onRemove }: TabItemProps) => {
  const handleClick = useCallback(() => {
    onSelect(tab.id)
  }, [onSelect, tab.id])

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onRemove(tab.id)
    },
    [onRemove, tab.id],
  )

  return (
    <div
      className={cn(
        'bg-surface hover:bg-overlay group flex max-w-[200px] min-w-[150px] cursor-pointer items-center gap-2 rounded-sm px-3 py-1 text-sm transition-colors',
        isActive && 'bg-overlay',
      )}
      onClick={handleClick}
    >
      <span className="flex-1 truncate">{tab.title}</span>
      <Button
        className="h-4 w-4 bg-transparent opacity-0 group-hover:opacity-100 hover:bg-transparent"
        onClick={handleRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
})

TabItem.displayName = 'TabItem'

export function TopNav() {
  const { tabs, activeTabId, setActiveTab, removeTab } = useTabsStore(
    useShallow((state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      setActiveTab: state.setActiveTab,
      removeTab: state.removeTab,
    })),
  )

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)
  const rafIdRef = useRef<number | null>(null)

  const lastArrowStateRef = useRef({ left: false, right: false })

  const updateArrowVisibility = useCallback(() => {
    if (rafIdRef.current !== null) return

    rafIdRef.current = requestAnimationFrame(() => {
      const container = scrollContainerRef.current
      if (container) {
        const { scrollLeft, scrollWidth, clientWidth } = container
        const newShowLeft = scrollLeft > 0
        const newShowRight = scrollLeft < scrollWidth - clientWidth - 1

        if (lastArrowStateRef.current.left !== newShowLeft) {
          setShowLeftArrow(newShowLeft)
          lastArrowStateRef.current.left = newShowLeft
        }
        if (lastArrowStateRef.current.right !== newShowRight) {
          setShowRightArrow(newShowRight)
          lastArrowStateRef.current.right = newShowRight
        }
      }
      rafIdRef.current = null
    })
  }, [])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const observer = new ResizeObserver(updateArrowVisibility)
    observer.observe(container)

    const handleScroll = () => updateArrowVisibility()
    container.addEventListener('scroll', handleScroll, { passive: true })

    updateArrowVisibility()

    return () => {
      observer.disconnect()
      container.removeEventListener('scroll', handleScroll)
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [updateArrowVisibility])

  useEffect(() => {
    updateArrowVisibility()
  }, [tabs, updateArrowVisibility])

  const scroll = useCallback((direction: 'left' | 'right') => {
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
  }, [])

  const handleScrollLeft = useCallback(() => scroll('left'), [scroll])
  const handleScrollRight = useCallback(() => scroll('right'), [scroll])

  return (
    <div className="bg-base flex h-10 items-center border-b px-2">
      <Button
        className={cn(
          'h-8 w-8',
          activeTabId === 'home' ? 'bg-base' : 'bg-transparent',
        )}
        onClick={() => setActiveTab('home')}
      >
        <Home className="h-4 w-4" />
      </Button>

      <div className="ml-2 flex flex-1 items-center overflow-hidden">
        {showLeftArrow && (
          <Button
            className="absolute left-0 z-10 h-8 w-8"
            onClick={handleScrollLeft}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        <div
          ref={scrollContainerRef}
          className="scrollbar-hide flex flex-1 items-center gap-1 overflow-x-auto"
        >
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={activeTabId === tab.id}
              onSelect={setActiveTab}
              onRemove={removeTab}
            />
          ))}
        </div>

        {showRightArrow && (
          <Button
            className="absolute right-0 z-10 h-8 w-8"
            onClick={handleScrollRight}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
