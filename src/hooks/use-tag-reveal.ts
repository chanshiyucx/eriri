import { useRef, useState } from 'react'
import { useClickOutside } from '@/hooks/use-click-outside'
import { usePressGestures } from '@/hooks/use-press-gestures'

/**
 * Tap-to-reveal interaction shared by every taggable image (grid, scroll strip,
 * preview): a single tap toggles `open` — which shows the tag controls and
 * title — while a double tap runs `onDoubleTap`. When `enabled` is false the tap
 * is ignored (the surface handles plain clicks itself) and `open` stays false.
 *
 * Attach the returned `ref` to the image element; a press anywhere outside it
 * (empty space or another image) collapses the reveal.
 */
export function useTagReveal(onDoubleTap: () => void, enabled = true) {
  const ref = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const close = () => {
    setOpen(false)
  }

  useClickOutside(ref, close, open)

  const gestures = usePressGestures({
    onTap: enabled
      ? () => {
          setOpen((v) => !v)
        }
      : undefined,
    onDoubleTap,
  })
  return { ref, open, gestures, close }
}
