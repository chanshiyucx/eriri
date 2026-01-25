import { LibraryArea } from './library-area'
import { Mask } from './mask'
import { Sidebar } from './sidebar'
import { TabArea } from './tab-area'
import { TabNav } from './tab-nav'

export function AppLayout() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <TabNav />

      <TabArea />

      <div className="flex flex-1">
        <Sidebar />
        <LibraryArea />
      </div>

      <Mask />
    </div>
  )
}
