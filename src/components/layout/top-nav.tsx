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
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/style'
import { useTabsStore, type Tab } from '@/store/tabs'
import { useUIStore } from '@/store/ui'

interface TabItemProps {
  tab: Tab
  isActive: boolean
  onSelect: (path: string) => void
  onRemove: (path: string) => void
}

const TabItem = memo(function TabItem({
  tab,
  isActive,
  onSelect,
  onRemove,
}: TabItemProps) {
  return (
    <div
      className={cn(
        'bg-surface hover:bg-overlay group flex max-w-[200px] min-w-[150px] cursor-pointer items-center gap-2 rounded-sm px-3 py-1 text-sm',
        isActive && 'bg-overlay text-love',
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

export function TopNav() {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)
  const rafIdRef = useRef<number | null>(null)
  const lastArrowStateRef = useRef({ left: false, right: false })

  const isSidebarCollapsed = useUIStore((s) => s.isSidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const toggleImmersive = useUIStore((s) => s.toggleImmersive)
  const tabs = useTabsStore((s) => s.tabs)
  const activeTab = useTabsStore((s) => s.activeTab)
  const removeTab = useTabsStore((s) => s.removeTab)
  const setActiveTab = useTabsStore((s) => s.setActiveTab)

  const stateRef = useRef({ tabs, activeTab })
  // eslint-disable-next-line react-hooks/refs
  stateRef.current = { tabs, activeTab }

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

    container.addEventListener('scroll', updateArrowVisibility, {
      passive: true,
    })

    updateArrowVisibility()

    return () => {
      observer.disconnect()
      container.removeEventListener('scroll', updateArrowVisibility)
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [updateArrowVisibility])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const { tabs, activeTab } = stateRef.current

      const key = e.key.toUpperCase()
      if (key === 'SPACEBAR' || key === ' ') {
        toggleImmersive()
      } else if (key === 'X') {
        removeTab(activeTab)
      } else if (key === 'A') {
        toggleSidebar()
      } else if (key === 'ARROWLEFT' || key === 'ARROWRIGHT') {
        const currentIndex = tabs.findIndex((tab) => tab.path === activeTab)

        if (key === 'ARROWLEFT') {
          if (currentIndex > 0) {
            setActiveTab(tabs[currentIndex - 1].path)
          } else if (currentIndex === -1 && tabs.length > 0) {
            setActiveTab(tabs[tabs.length - 1].path)
          } else if (currentIndex === 0) {
            setActiveTab('')
          }
        } else if (key === 'ARROWRIGHT') {
          if (currentIndex < tabs.length - 1 && currentIndex !== -1) {
            setActiveTab(tabs[currentIndex + 1].path)
          } else if (currentIndex === -1 && tabs.length > 0) {
            setActiveTab(tabs[0].path)
          } else if (currentIndex === tabs.length - 1) {
            setActiveTab('')
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleImmersive, removeTab, toggleSidebar, setActiveTab])

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
        className={cn('mx-1 h-6 w-6', !activeTab && 'text-love')}
        onClick={() => setActiveTab('')}
      >
        <Home className="h-4 w-4" />
      </Button>

      <div className="ml-2 flex flex-1 items-center overflow-hidden">
        {showLeftArrow && (
          <Button
            className="absolute left-0 z-10 h-6 w-6"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        <ScrollArea
          ref={scrollContainerRef}
          orientation="horizontal"
          viewportClassName="flex-1"
          className="flex items-center gap-1"
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
        </ScrollArea>

        {showRightArrow && (
          <Button
            className="absolute right-0 z-10 h-6 w-6"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
