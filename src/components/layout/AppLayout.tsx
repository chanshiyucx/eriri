import { useState } from 'react'
import { useTabsStore } from '@/store/tabs'
import { ContentArea } from './ContentArea'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'

export function AppLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { tabs, activeTabId, setActiveTab, removeTab } = useTabsStore()

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
  }

  const handleTabClose = (tabId: string) => {
    removeTab(tabId)
  }

  return (
    <div className="bg-background text-foreground flex h-screen w-full flex-col overflow-hidden">
      {/* Top Navigation */}
      <TopNav
        className="flex-none"
        activeTabId={activeTabId}
        tabs={tabs}
        onTabChange={handleTabChange}
        onTabClose={handleTabClose}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          className="hidden flex-none border-r md:flex"
          isCollapsed={isCollapsed}
          toggleSidebar={() => setIsCollapsed(!isCollapsed)}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <ContentArea
            className="h-full"
            isCollapsed={isCollapsed}
            toggleSidebar={() => setIsCollapsed(!isCollapsed)}
          />
        </main>
      </div>
    </div>
  )
}
