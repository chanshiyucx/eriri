import {
  ChevronLeft,
  ChevronRight,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTabsStore, type Tab } from '@/store/tabs'
import { useUIStore } from '@/store/ui'

interface TabItemProps {
  tab: Tab
  isActive: boolean
  onSelect: (path: string) => void
  onRemove: (path: string) => void
}

const TabItem = memo(({ tab, isActive, onSelect, onRemove }: TabItemProps) => {
  return (
    <div
      className={cn(
        'bg-surface hover:bg-overlay group flex max-w-[200px] min-w-[150px] cursor-pointer items-center gap-2 rounded-sm px-3 py-1 text-sm',
        isActive && 'bg-overlay text-rose',
      )}
      onClick={() => onSelect(tab.path)}
    >
      <span className="flex-1 truncate">{tab.title}</span>
      <Button
        className="h-4 w-4 bg-transparent opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          onRemove(tab.path)
        }}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
})

TabItem.displayName = 'TabItem'

export function TopNav() {
  const { tabs, activeTab, setActiveTab, removeTab } = useTabsStore()
  const { isSidebarCollapsed, toggleSidebar } = useUIStore()

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
  }, [updateArrowVisibility])

  // Keyboard navigation for tab switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const currentIndex = tabs.findIndex((tab) => tab.path === activeTab)

        if (e.key === 'ArrowUp') {
          // Switch to previous tab
          if (currentIndex > 0) {
            setActiveTab(tabs[currentIndex - 1].path)
          } else if (currentIndex === -1 && tabs.length > 0) {
            // If no tab is active, go to last tab
            setActiveTab(tabs[tabs.length - 1].path)
          } else if (currentIndex === 0) {
            // At first tab, go to home (no tab)
            setActiveTab('')
          }
        } else if (e.key === 'ArrowDown') {
          // Switch to next tab
          if (currentIndex < tabs.length - 1 && currentIndex !== -1) {
            setActiveTab(tabs[currentIndex + 1].path)
          } else if (currentIndex === -1 && tabs.length > 0) {
            // If no tab is active, go to first tab
            setActiveTab(tabs[0].path)
          } else if (currentIndex === tabs.length - 1) {
            // At last tab, go to home (no tab)
            setActiveTab('')
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tabs, activeTab, setActiveTab])

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

  console.log('Render TopNav ---', activeTab)

  return (
    <div className="bg-base flex h-8 shrink-0 items-center border-b px-2">
      <Button className="mx-1 h-6 w-6" onClick={toggleSidebar}>
        {isSidebarCollapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </Button>

      <Button
        className={cn('mx-1 h-6 w-6', !activeTab && 'text-rose')}
        onClick={() => setActiveTab('')}
      >
        <Home className="h-4 w-4" />
      </Button>

      <div className="ml-2 flex flex-1 items-center overflow-hidden">
        {showLeftArrow && (
          <Button
            className="absolute left-0 z-10 h-6 w-6"
            onClick={handleScrollLeft}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        <div
          ref={scrollContainerRef}
          className="scrollbar-hide flex flex-1 items-center gap-2 overflow-x-auto"
        >
          {tabs.map((tab) => (
            <TabItem
              key={tab.path}
              tab={tab}
              isActive={activeTab === tab.path}
              onSelect={setActiveTab}
              onRemove={removeTab}
            />
          ))}
        </div>

        {showRightArrow && (
          <Button
            className="absolute right-0 z-10 h-6 w-6"
            onClick={handleScrollRight}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
