import { Home, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useEffect, useEffectEvent } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLatest } from '@/hooks/use-latest'
import { cn } from '@/lib/style'
import { useTabsStore, type Tab } from '@/store/tabs'
import { useUIStore } from '@/store/ui'

interface TabItemProps {
  tab: Tab
  isActive: boolean
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

function TabItem({ tab, isActive, onSelect, onRemove }: TabItemProps) {
  return (
    <div
      className={cn(
        'bg-surface hover:bg-overlay group flex max-w-[200px] min-w-[150px] cursor-pointer items-center gap-2 rounded-sm px-3 py-1 text-sm',
        isActive && 'bg-overlay text-love',
      )}
      onClick={() => onSelect(tab.id)}
    >
      <span className="flex-1 truncate">{tab.title}</span>
      <Button
        className="h-4 w-4 bg-transparent opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          onRemove(tab.id)
        }}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}

export function TabNav() {
  const isSidebarCollapsed = useUIStore((s) => s.isSidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const toggleImmersive = useUIStore((s) => s.toggleImmersive)
  const tabs = useTabsStore((s) => s.tabs)
  const activeTab = useTabsStore((s) => s.activeTab)
  const removeTab = useTabsStore((s) => s.removeTab)
  const setActiveTab = useTabsStore((s) => s.setActiveTab)

  const stateRef = useLatest({ tabs, activeTab })

  const navigateTab = (direction: 1 | -1) => {
    const { tabs, activeTab } = stateRef.current
    if (!tabs.length) return

    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab)

    if (direction === -1) {
      if (currentIndex > 0) {
        setActiveTab(tabs[currentIndex - 1].id)
      } else if (currentIndex === -1) {
        setActiveTab(tabs[tabs.length - 1].id)
      } else if (currentIndex === 0) {
        setActiveTab('')
      }
    } else if (direction === 1) {
      if (currentIndex < tabs.length - 1 && currentIndex !== -1) {
        setActiveTab(tabs[currentIndex + 1].id)
      } else if (currentIndex === -1) {
        setActiveTab(tabs[0].id)
      } else if (currentIndex === tabs.length - 1) {
        setActiveTab('')
      }
    }
  }

  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return

    const { activeTab } = stateRef.current
    switch (e.code) {
      case 'Space':
        e.preventDefault() // Prevent page scrolling
        toggleImmersive()
        break
      case 'KeyX':
        removeTab(activeTab)
        break
      case 'KeyA':
        toggleSidebar()
        break
      case 'ArrowLeft':
      case 'ArrowRight':
        navigateTab(e.code === 'ArrowLeft' ? -1 : 1)
        break
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="bg-base flex h-8 items-center gap-2 border-b px-2">
      <Button className="h-6 w-6" onClick={toggleSidebar}>
        {isSidebarCollapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </Button>

      <Button
        className={cn('h-6 w-6', !activeTab && 'text-love')}
        onClick={() => setActiveTab('')}
      >
        <Home className="h-4 w-4" />
      </Button>

      <ScrollArea
        orientation="horizontal"
        viewportClassName="flex-1"
        className="flex items-center gap-1"
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            onSelect={setActiveTab}
            onRemove={removeTab}
          />
        ))}
      </ScrollArea>
    </div>
  )
}
