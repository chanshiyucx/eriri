import { cn } from '@/lib/style'
import { useUIStore } from '@/store/ui'
import { useIsPhone } from './use-is-phone'

export function usePanelNav() {
  const isPhone = useIsPhone()
  const isSidebarCollapsed = useUIStore((s) => s.isSidebarCollapsed)
  const isMiddleCollapsed = useUIStore((s) => s.isMiddleCollapsed)
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed)
  const setMiddleCollapsed = useUIStore((s) => s.setMiddleCollapsed)

  const readerVisible = !isPhone || (isSidebarCollapsed && isMiddleCollapsed)

  const middleClass = cn(
    isSidebarCollapsed && !isMiddleCollapsed ? 'flex' : 'hidden',
    isMiddleCollapsed ? 'md:hidden' : 'md:flex',
  )
  const readerClass = cn(
    isSidebarCollapsed && isMiddleCollapsed ? 'flex' : 'hidden',
    'md:flex',
  )

  const openMiddle = () => {
    if (!isPhone) return
    setSidebarCollapsed(true)
    setMiddleCollapsed(false)
  }
  const openReader = () => {
    if (!isPhone) return
    setMiddleCollapsed(true)
  }

  return {
    isPhone,
    readerVisible,
    middleClass,
    readerClass,
    openMiddle,
    openReader,
  }
}
