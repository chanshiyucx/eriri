import '@/styles/tailwindcss.css'
import { HydrationGuard } from '@/components/hydration-guard'
import { AppLayout } from '@/components/layout/app-layout'

function App() {
  return (
    <HydrationGuard>
      <AppLayout />
    </HydrationGuard>
  )
}

export default App
