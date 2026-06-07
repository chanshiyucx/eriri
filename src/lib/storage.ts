import type { StateStorage } from 'zustand/middleware'

/**
 * Zustand persistence backed by the server store (`/api/store/:key`), so the
 * backend owns every persisted blob.
 */
const backend = {
  read: async (key: string): Promise<string | null> => {
    const res = await fetch(`/api/store/${encodeURIComponent(key)}`, {
      cache: 'no-store',
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
  },
  write: async (key: string, data: string): Promise<void> => {
    const res = await fetch(`/api/store/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: data,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  },
  remove: async (key: string): Promise<void> => {
    const res = await fetch(`/api/store/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  },
}

export const createServerStorage = (storeName: string): StateStorage => ({
  getItem: async (): Promise<string | null> => {
    try {
      return await backend.read(storeName)
    } catch {
      return null
    }
  },
  setItem: async (_name: string, value: string): Promise<void> => {
    try {
      await backend.write(storeName, value)
    } catch (error) {
      console.error(`[Storage] Failed to write ${storeName}:`, error)
    }
  },
  removeItem: async (): Promise<void> => {
    try {
      await backend.remove(storeName)
    } catch (error) {
      console.error(`[Storage] Failed to remove ${storeName}:`, error)
    }
  },
})
