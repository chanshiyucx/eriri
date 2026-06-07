import { cn } from '@/lib/style'
import { useUIStore } from '@/store/ui'

export function Mask() {
  const isScanning = useUIStore((s) => s.isScanning)

  return (
    <div
      className={cn('fixed inset-0 z-100', isScanning ? 'visible' : 'hidden')}
    ></div>
  )
}
