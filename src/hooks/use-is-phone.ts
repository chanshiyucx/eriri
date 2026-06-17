import { useSyncExternalStore } from 'react'

// Phones are anything below Tailwind's `md` breakpoint (768px); iPad/Mac sit
// at or above it. 767.98px sidesteps fractional-DPI rounding at the boundary.
const PHONE_QUERY = '(max-width: 767.98px)'

export const getServerPhoneSnapshot = () => false

function subscribe(callback: () => void) {
  const mql = window.matchMedia(PHONE_QUERY)
  mql.addEventListener('change', callback)
  return () => {
    mql.removeEventListener('change', callback)
  }
}

export function useIsPhone() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_QUERY).matches,
    getServerPhoneSnapshot,
  )
}
