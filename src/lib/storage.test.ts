import { describe, expect, it, vi } from 'vitest'
import { createServerStorage } from '@/lib/storage'

describe('server storage', () => {
  it('reads persisted data from the named backend store', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"state":{}}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createServerStorage('ui settings').getItem('ignored'),
    ).resolves.toBe('{"state":{}}')

    expect(fetchMock).toHaveBeenCalledWith('/api/store/ui%20settings', {
      cache: 'no-store',
    })
  })

  it('treats a missing backend store as empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    )

    await expect(createServerStorage('tabs').getItem('ignored')).resolves.toBe(
      null,
    )
  })

  it('writes and removes persisted data through the backend store', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const storage = createServerStorage('tabs')

    await storage.setItem('ignored', '{"state":{"tabs":[]}}')
    await storage.removeItem('ignored')

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/store/tabs', {
      method: 'PUT',
      body: '{"state":{"tabs":[]}}',
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/store/tabs', {
      method: 'DELETE',
    })
  })

  it('falls back and logs when backend persistence fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    )
    const storage = createServerStorage('ui')

    await expect(storage.getItem('ignored')).resolves.toBe(null)
    await expect(storage.setItem('ignored', '{}')).resolves.toBeUndefined()
    await expect(storage.removeItem('ignored')).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalledWith(
      '[Storage] Failed to write ui:',
      expect.any(Error),
    )
    expect(console.error).toHaveBeenCalledWith(
      '[Storage] Failed to remove ui:',
      expect.any(Error),
    )
  })
})
