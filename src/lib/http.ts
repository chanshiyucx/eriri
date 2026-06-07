/**
 * The app is served by the Rust backend over HTTP (same origin), so all API
 * and image URLs are relative; the scanner already emits `/file?path=…` URLs.
 */

/** GET a JSON endpoint, never cached — the backend is the source of truth. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`)
  return (await res.json()) as T
}
