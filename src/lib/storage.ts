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
