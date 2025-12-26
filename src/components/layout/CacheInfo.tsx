import { ask } from '@tauri-apps/plugin-dialog'
import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cleanThumbnailCache, getThumbnailStats } from '@/lib/scanner'
import type { ImageCache } from '@/types/library'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

export function CacheInfo() {
  const [cache, setCache] = useState<ImageCache>({ count: 0, size: 0 })
  const [isLoading, setIsLoading] = useState(false)

  const loadCacheStats = async () => {
    const stats = await getThumbnailStats()
    setCache(stats)
  }

  useEffect(() => {
    void loadCacheStats()
  }, [])

  const handleCleanCache = async () => {
    const yes = await ask('确认清理缩略图缓存？', {
      title: '清理缓存',
      kind: 'warning',
    })
    if (!yes) return

    setIsLoading(true)
    try {
      await cleanThumbnailCache()
      await loadCacheStats()
    } catch (error) {
      console.error('Failed to clean cache:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-overlay flex h-10 items-center justify-evenly rounded-full text-xs">
      <div className="flex gap-2">
        <div>{cache.count} 项</div>
        <div>{formatBytes(cache.size)}</div>
      </div>
      <Button
        onClick={() => {
          void handleCleanCache()
        }}
        disabled={isLoading || cache.count === 0}
        className="hover:text-rose h-6 w-6 bg-transparent p-0 transition-colors"
        title="清理缓存"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
