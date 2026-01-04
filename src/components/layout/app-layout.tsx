import { ContentArea } from './content-area'
import { Sidebar } from './sidebar'
import { TopNav } from './top-nav'

export function AppLayout() {
  return (
    <div className="flex h-screen w-screen flex-col">
      <TopNav />

      <div className="flex flex-1">
        <Sidebar />
        <ContentArea />
      </div>
    </div>
  )
}
