import { invoke } from '@tauri-apps/api/core'
import type { StateStorage } from 'zustand/middleware'

/**
 * Create a Tauri file-based storage adapter for Zustand persistence.
 * Stores data in cache_dir/store/{storeName}.json
 *
 * If cache_dir is not configured, getItem returns null (store uses defaults),
 * and setItem/removeItem are no-ops.
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
    } catch {
      // Silently fail if cache dir not configured
    }
  },
  removeItem: async (): Promise<void> => {
    try {
      await invoke('remove_store_data', { key: storeName })
    } catch {
      // Silently fail if cache dir not configured
    }
  },
})

/**
 * Create a debounced Tauri file storage adapter for high-frequency writes.
 * Batches writes to reduce disk I/O.
 */
export const createDebouncedTauriFileStorage = (
  storeName: string,
  wait = 2000,
): StateStorage => {
  let pending: {
    timeout: ReturnType<typeof setTimeout>
    value: string
  } | null = null

  const flush = async () => {
    if (pending) {
      clearTimeout(pending.timeout)
      const value = pending.value
      pending = null
      try {
        await invoke('write_store_data', { key: storeName, data: value })
      } catch {
        // Silently fail if cache dir not configured
      }
    }
  }

  // Flush on page unload to prevent data loss
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      void flush()
    })
  }

  return {
    getItem: async (): Promise<string | null> => {
      // Return pending value if exists (for consistency)
      if (pending) {
        return pending.value
      }
      try {
        return await invoke<string | null>('read_store_data', {
          key: storeName,
        })
      } catch {
        return null
      }
    },

    setItem: (_name: string, value: string): void => {
      if (pending) {
        clearTimeout(pending.timeout)
      }

      const timeout = setTimeout(async () => {
        pending = null
        try {
          await invoke('write_store_data', { key: storeName, data: value })
        } catch {
          // Silently fail if cache dir not configured
        }
      }, wait)

      pending = { timeout, value }
    },

    removeItem: async (): Promise<void> => {
      if (pending) {
        clearTimeout(pending.timeout)
        pending = null
      }
      try {
        await invoke('remove_store_data', { key: storeName })
      } catch {
        // Silently fail if cache dir not configured
      }
    },
  }
}
