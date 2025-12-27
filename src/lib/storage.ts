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

export const createDebouncedIDBStorage = (
  wait = 2000,
): StateStorage & { cancel: (name: string) => void } => {
  const pending = new Map<string, ReturnType<typeof setTimeout>>()

  return {
    getItem: async (name: string): Promise<string | null> => {
      return (await get<string>(name)) ?? null
    },
    setItem: (name: string, value: string): void | Promise<void> => {
      if (pending.has(name)) {
        clearTimeout(pending.get(name))
      }

      const timeout = setTimeout(async () => {
        pending.delete(name)
        await set(name, value)
      }, wait)

      pending.set(name, timeout)
    },
    removeItem: async (name: string): Promise<void> => {
      if (pending.has(name)) {
        clearTimeout(pending.get(name))
        pending.delete(name)
      }
      await del(name)
    },
    cancel: (name: string) => {
      if (pending.has(name)) {
        clearTimeout(pending.get(name))
        pending.delete(name)
      }
    },
  }
}
