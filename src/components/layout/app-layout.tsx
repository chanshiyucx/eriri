import { LibraryArea } from './library-area'
import { Sidebar } from './sidebar'
import { TabArea } from './tab-area'
import { TopNav } from './top-nav'

export function AppLayout() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <TopNav />

      <TabArea />

      <div className="flex flex-1">
        <Sidebar />
        <LibraryArea />
      </div>
    </div>
  )
}
