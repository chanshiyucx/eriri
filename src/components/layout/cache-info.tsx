import { ask, open as openDialog } from '@tauri-apps/plugin-dialog'
import { FolderOpen, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  cleanAllThumbnailCache,
  cleanExpiredThumbnailCache,
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
    console.log('dir---', dir)
    setCacheDirState(dir)
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleCleanCache = async () => {
    const cleanAll = await ask('选择清理过期或清理全部缓存。', {
      title: '清理缓存',
      kind: 'info',
      okLabel: '清理全部',
      cancelLabel: '清理过期',
    })

    setIsLoading(true)
    try {
      if (cleanAll) {
        await cleanAllThumbnailCache()
      } else {
        await cleanExpiredThumbnailCache()
      }
      await loadData()
    } catch (error) {
      console.error('Failed to clean cache:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const selectAndSetCacheDir = async (title: string) => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        recursive: true,
        title,
      })
      if (!selected || typeof selected !== 'string') return

      if (selected !== cacheDir) {
        await setCacheDir(selected)
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to set cache dir:', error)
    }
  }

  const handleCacheDir = async () => {
    if (!cacheDir) {
      await selectAndSetCacheDir('选择缓存目录')
      return
    }

    const wantChange = await ask('选择打开或更换缓存目录。', {
      title: '缓存目录',
      kind: 'info',
      okLabel: '更换',
      cancelLabel: '打开',
    })

    if (wantChange) {
      await selectAndSetCacheDir('更换缓存目录')
    } else {
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
          void handleCacheDir()
        }}
        disabled={isLoading}
        className="hover:text-love h-6 w-6 bg-transparent p-0 transition-colors"
        title={cacheDir ? '打开/更换缓存目录' : '设置缓存目录'}
      >
        <FolderOpen className="h-4 w-4" />
      </Button>
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
