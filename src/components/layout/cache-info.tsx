import { ask, open as openDialog } from '@tauri-apps/plugin-dialog'
import { FolderOpen, Trash2 } from 'lucide-react'
import { startTransition, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  cleanAllThumbnailCache,
  cleanExpiredThumbnailCache,
  getCacheDir,
  getThumbnailStats,
  openPathNative,
  setCacheDir,
} from '@/lib/scanner'
import { useLibraryStore } from '@/store/library'
import type { ImageCache } from '@/types/library'

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

export function CacheInfo() {
  const [cache, setCache] = useState<ImageCache>({ count: 0, size: 0 })
  const [cacheDir, setCacheDirState] = useState<string | null>(null)
  const isScanning = useLibraryStore((s) => s.isScanning)

  const loadData = async (rescan = false) => {
    const stats = await getThumbnailStats(rescan)
    const dir = await getCacheDir()
    startTransition(() => {
      setCache(stats)
      setCacheDirState(dir)
    })
  }

  useEffect(() => {
    if (!isScanning) {
      void loadData()
    }
  }, [isScanning])

  const handleCleanCache = async () => {
    try {
      const cleanAll = await ask('选择清理过期或清理全部缓存。', {
        title: '清理缓存',
        kind: 'info',
        okLabel: '清理全部',
        cancelLabel: '清理过期',
      })

      if (cleanAll) {
        await cleanAllThumbnailCache()
      } else {
        await cleanExpiredThumbnailCache()
      }
      await loadData()
    } catch (error) {
      alert('清理缓存失败: ' + String(error))
    }
  }

  const handleChangeDir = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        recursive: true,
        defaultPath: cacheDir ?? '',
        title: cacheDir ? '更换缓存目录' : '选择缓存目录',
      })
      if (!selected || selected === cacheDir) return

      await setCacheDir(selected)
      void loadData(true)
      window.location.reload()
    } catch (error) {
      alert('设置缓存目录失败: ' + String(error))
    }
  }

  const handleOpenDir = async () => {
    if (cacheDir) {
      await openPathNative(cacheDir)
    } else {
      await handleChangeDir()
    }
  }

  return (
    <div className="bg-overlay flex h-10 items-center justify-evenly rounded-full text-xs">
      <div className="flex gap-2" title={cacheDir ?? 'Default Cache Dir'}>
        <div>{cache.count} 项</div>
        <div>{formatBytes(cache.size)}</div>
      </div>
      <Button
        onClick={() => void handleOpenDir()}
        onContextMenu={(e) => {
          e.preventDefault()
          void handleChangeDir()
        }}
        className="hover:text-love h-6 w-6 bg-transparent p-0 transition-colors"
        title={cacheDir ? '左键打开，右键更换' : '设置缓存目录'}
      >
        <FolderOpen className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => void handleCleanCache()}
        disabled={cache.count === 0}
        className="hover:text-love h-6 w-6 bg-transparent p-0 transition-colors"
        title="清理缓存"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
