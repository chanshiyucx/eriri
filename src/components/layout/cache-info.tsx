import { ask, open as openDialog } from '@tauri-apps/plugin-dialog'
import { FolderOpen, Settings, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  cleanThumbnailCache,
  getCacheDir,
  getThumbnailStats,
  openPathNative,
  setCacheDir,
} from '@/lib/scanner'
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
  const [cacheDir, setCacheDirState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadData = async () => {
    const stats = await getThumbnailStats()
    setCache(stats)
    const dir = await getCacheDir()
    setCacheDirState(dir)
  }

  useEffect(() => {
    void loadData()
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
      await loadData()
    } catch (error) {
      console.error('Failed to clean cache:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetCacheDir = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        recursive: true,
        title: 'Select Cache Directory',
      })
      if (!selected || typeof selected !== 'string') return

      await setCacheDir(selected)
      await loadData()
    } catch (error) {
      console.error('Failed to set cache dir:', error)
    }
  }

  const handleOpenCacheDir = async () => {
    if (cacheDir) {
      await openPathNative(cacheDir)
    }
  }

  return (
    <div className="bg-overlay flex h-10 items-center justify-evenly rounded-full text-xs">
      <div className="flex gap-2" title={cacheDir ?? 'Default Cache Dir'}>
        <div>{cache.count} 项</div>
        <div>{formatBytes(cache.size)}</div>
      </div>
      <Button
        onClick={() => {
          void handleSetCacheDir()
        }}
        disabled={isLoading}
        className="hover:text-love h-6 w-6 bg-transparent p-0 transition-colors"
        title="设置缓存目录"
      >
        <Settings className="h-4 w-4" />
      </Button>
      {cacheDir && (
        <Button
          onClick={() => {
            void handleOpenCacheDir()
          }}
          disabled={isLoading}
          className="hover:text-love h-6 w-6 bg-transparent p-0 transition-colors"
          title="打开缓存目录"
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      )}
      <Button
        onClick={() => {
          void handleCleanCache()
        }}
        disabled={isLoading || cache.count === 0}
        className="hover:text-love h-6 w-6 bg-transparent p-0 transition-colors"
        title="清理缓存"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
