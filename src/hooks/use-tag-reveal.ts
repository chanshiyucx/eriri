import { useState } from 'react'
import { usePressGestures } from '@/hooks/use-press-gestures'

/**
 * Tap-to-reveal interaction shared by every taggable image (grid, scroll strip,
 * preview): a single tap toggles `open` — which shows the tag controls and
 * title — while a double tap runs `onDoubleTap`. When `enabled` is false the tap
 * is ignored (the surface handles plain clicks itself) and `open` stays false.
 */
export function useTagReveal(onDoubleTap: () => void, enabled = true) {
  const [open, setOpen] = useState(false)
  const gestures = usePressGestures({
    onTap: enabled ? () => setOpen((v) => !v) : undefined,
    onDoubleTap,
  })
  return { open, gestures, close: () => setOpen(false) }
}
