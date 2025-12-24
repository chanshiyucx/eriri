import { ContentArea } from './ContentArea'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'

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
