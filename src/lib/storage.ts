import { invoke } from '@tauri-apps/api/core'
import type { StateStorage } from 'zustand/middleware'

/**
 * Create a Tauri file-based storage adapter for Zustand persistence.
 * Stores data in cache_dir/store/{storeName}.json
 */
export const createTauriFileStorage = (storeName: string): StateStorage => ({
  getItem: async (): Promise<string | null> => {
    try {
      return await invoke<string | null>('read_store_data', { key: storeName })
    } catch {
      return null
    }
  },
  setItem: async (_name: string, value: string): Promise<void> => {
    try {
      await invoke('write_store_data', { key: storeName, data: value })
    } catch (error) {
      console.error(`[Storage] Failed to write ${storeName}:`, error)
    }
  },
  removeItem: async (): Promise<void> => {
    try {
      await invoke('remove_store_data', { key: storeName })
    } catch (error) {
      console.error(`[Storage] Failed to remove ${storeName}:`, error)
    }
  },
})

/**
 * Create a debounced Tauri file storage adapter for high-frequency writes.
 * - Batches writes to reduce disk I/O
 * - Tracks pending writes for read-after-write consistency
 * - Flushes pending writes on page unload
 */
export const createDebouncedTauriFileStorage = (
  storeName: string,
  wait = 2000,
): StateStorage => {
  let pendingValue: string | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let flushPromise: Promise<void> | null = null
  let flushResolve: (() => void) | null = null

  const doWrite = async (value: string): Promise<void> => {
    try {
      await invoke('write_store_data', { key: storeName, data: value })
    } catch (error) {
      console.error(`[Storage] Failed to write ${storeName}:`, error)
    }
  }

  const flush = async (): Promise<void> => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    if (pendingValue !== null) {
      const value = pendingValue
      pendingValue = null
      await doWrite(value)
    }

    if (flushResolve) {
      flushResolve()
      flushResolve = null
      flushPromise = null
    }
  }

  window.addEventListener('beforeunload', () => void flush())

  return {
    getItem: async (): Promise<string | null> => {
      if (flushPromise) await flushPromise
      if (pendingValue !== null) return pendingValue

      try {
        return await invoke<string | null>('read_store_data', {
          key: storeName,
        })
      } catch {
        return null
      }
    },

    setItem: (_name: string, value: string): void => {
      if (timeoutId) clearTimeout(timeoutId)

      pendingValue = value
      flushPromise ??= new Promise<void>((resolve) => {
        flushResolve = resolve
      })

      timeoutId = setTimeout(() => {
        timeoutId = null
        const valueToWrite = pendingValue
        pendingValue = null

        if (valueToWrite) {
          void doWrite(valueToWrite).finally(() => {
            if (flushResolve) {
              flushResolve()
              flushResolve = null
              flushPromise = null
            }
          })
        }
      }, wait)
    },

    removeItem: async (): Promise<void> => {
      await flush()
      try {
        await invoke('remove_store_data', { key: storeName })
      } catch (error) {
        console.error(`[Storage] Failed to remove ${storeName}:`, error)
      }
    },
  }
}
