import { describe, expect, it, vi } from 'vitest'
import { apiGet } from '@/lib/http'

describe('HTTP helper', () => {
  it('fetches JSON without using a cached response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiGet<{ ok: boolean }>('/api/example')).resolves.toEqual({
      ok: true,
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/example', {
      cache: 'no-store',
    })
  })

  it('throws an HTTP error when the backend rejects a GET', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    )

    await expect(apiGet('/api/example')).rejects.toThrow(
      'HTTP 503 for /api/example',
    )
  })
})
