import { useEffect, useState } from 'react'

export function useCollapse() {
  const [collapsed, setCollapsed] = useState(1) // 0 1 2

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.code) {
        case 'KeyS':
          setCollapsed((prev) => Math.max(0, prev - 1))
          break
        case 'KeyD':
          setCollapsed((prev) => Math.min(2, prev + 1))
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return { collapsed, setCollapsed }
}
