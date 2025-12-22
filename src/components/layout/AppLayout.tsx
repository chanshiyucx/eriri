import { AnimatePresence, motion } from 'framer-motion'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import { ContentArea } from './ContentArea'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'

export function AppLayout() {
  const { isSidebarCollapsed, toggleSidebar } = useUIStore()
  const { tabs, activeTabId, setActiveTab, removeTab, isImmersive } =
    useTabsStore()

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
  }

  const handleTabClose = (tabId: string) => {
    removeTab(tabId)
  }

  return (
    <div className="bg-background text-foreground flex h-screen w-full flex-col overflow-hidden">
      {/* Top Navigation */}
      <AnimatePresence>
        {!isImmersive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <TopNav
              className="flex-none"
              activeTabId={activeTabId}
              tabs={tabs}
              onTabChange={handleTabChange}
              onTabClose={handleTabClose}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence>
          {!isImmersive && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="hidden flex-none overflow-hidden md:flex"
            >
              <Sidebar
                isCollapsed={isSidebarCollapsed}
                toggleSidebar={toggleSidebar}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <ContentArea
            className="h-full"
            isCollapsed={isSidebarCollapsed}
            toggleSidebar={toggleSidebar}
          />
        </main>
      </div>
    </div>
  )
}
