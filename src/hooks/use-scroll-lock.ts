import { useRef } from 'react'

const SCROLL_LOCK_TIMEOUT = 500

export function useScrollLock() {
  const isLock = useRef(true)
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const visibleIndices = useRef(new Set<number>())

  const lockScroll = () => {
    if (lockTimer.current) {
      clearTimeout(lockTimer.current)
    }

    visibleIndices.current.clear()
    isLock.current = true
    lockTimer.current = setTimeout(() => {
      isLock.current = false
    }, SCROLL_LOCK_TIMEOUT)
  }

  return { isLock, visibleIndices, lockScroll }
}
