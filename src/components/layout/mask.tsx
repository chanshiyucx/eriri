import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'

export function Mask() {
  const isScanning = useLibraryStore((s) => s.isScanning)

  return (
    <div
      className={cn('fixed inset-0 z-100', isScanning ? 'visible' : 'hidden')}
    ></div>
  )
}
