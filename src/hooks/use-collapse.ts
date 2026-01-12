import { useEffect, useState } from 'react'

export function useCollapse() {
  const [collapsed, setCollapsed] = useState(1) // 0 1 2

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toUpperCase()
      if (key === 'S') {
        setCollapsed((prev) => Math.max(0, prev - 1))
      } else if (key === 'D') {
        setCollapsed((prev) => Math.min(2, prev + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return { collapsed, setCollapsed }
}
