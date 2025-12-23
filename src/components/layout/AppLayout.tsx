import { useUIStore } from '@/store/ui'
import { ContentArea } from './ContentArea'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'

export function AppLayout() {
  const { isSidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <div className="flex h-screen w-screen flex-col">
      <TopNav />

      <div className="flex flex-1">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          toggleSidebar={toggleSidebar}
        />

        <ContentArea
          isCollapsed={isSidebarCollapsed}
          toggleSidebar={toggleSidebar}
        />
      </div>
    </div>
  )
}
