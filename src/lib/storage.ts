import { del, get, set } from 'idb-keyval'
import type { StateStorage } from 'zustand/middleware'

export const createIDBStorage = (): StateStorage => ({
  getItem: async (name: string): Promise<string | null> => {
    return (await get<string>(name)) ?? null
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name)
  },
})

interface DebouncedStorage extends StateStorage {
  flush: () => Promise<void>
}

export const createDebouncedIDBStorage = (wait = 2000): DebouncedStorage => {
  const pending = new Map<
    string,
    { timeout: ReturnType<typeof setTimeout>; value: string }
  >()

  const flushItem = async (name: string) => {
    const item = pending.get(name)
    if (item) {
      clearTimeout(item.timeout)
      pending.delete(name)
      await set(name, item.value)
    }
  }

  return {
    getItem: async (name: string): Promise<string | null> => {
      // Return pending value if exists (for consistency)
      const pendingItem = pending.get(name)
      if (pendingItem) {
        return pendingItem.value
      }
      return (await get<string>(name)) ?? null
    },

    setItem: (name: string, value: string): void => {
      const existing = pending.get(name)
      if (existing) {
        clearTimeout(existing.timeout)
      }

      const timeout = setTimeout(async () => {
        pending.delete(name)
        await set(name, value)
      }, wait)

      pending.set(name, { timeout, value })
    },

    removeItem: async (name: string): Promise<void> => {
      const existing = pending.get(name)
      if (existing) {
        clearTimeout(existing.timeout)
        pending.delete(name)
      }
      await del(name)
    },

    /**
     * Flush all pending writes immediately
     */
    flush: async (): Promise<void> => {
      const flushPromises = Array.from(pending.keys()).map(flushItem)
      await Promise.all(flushPromises)
    },
  }
}
