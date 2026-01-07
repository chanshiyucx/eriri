import { useSyncExternalStore, type ReactNode } from 'react'
import { useLibraryStore } from '@/store/library'

interface HydrationGuardProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Blocks rendering until Zustand stores hydrate from async storage.
 */
export function HydrationGuard({
  children,
  fallback = null,
}: HydrationGuardProps) {
  const hasHydrated = useSyncExternalStore(
    useLibraryStore.persist.onFinishHydration,
    () => useLibraryStore.persist.hasHydrated(),
    () => false,
  )

  return hasHydrated ? children : fallback
}
