import { useEffect, useRef, type PointerEvent } from 'react'

const DOUBLE_MS = 350 // max gap between the two taps of a double-tap
const TAP_SLOP = 16 // a press may wiggle this much and still be a "tap"
const GAP_SLOP = 40 // the two taps may land this far apart

interface PressGestures {
  onTap?: () => void
  onDoubleTap?: () => void
}

// Spread onto a child (e.g. an overlaid button) that handles its own tap and
// must not let the parent's press gestures, which ride these events, also fire.
export const stopPointerProps = {
  onPointerDown: (e: PointerEvent) => {
    e.stopPropagation()
  },
  onPointerUp: (e: PointerEvent) => {
    e.stopPropagation()
  },
}

/**
 * Tap and double-tap from one pointer handler, for mouse and touch alike. When
 * both are wanted a single tap is held back by `DOUBLE_MS` to see whether a
 * second tap turns it into a double; with only `onDoubleTap` it fires at once.
 */
export function usePressGestures({ onTap, onDoubleTap }: PressGestures) {
  const down = useRef({ x: 0, y: 0 })
  const lastTap = useRef({ time: 0, x: 0, y: 0 })
  const tapTimer = useRef<number | null>(null)

  const clearTap = () => {
    if (tapTimer.current !== null) {
      clearTimeout(tapTimer.current)
      tapTimer.current = null
    }
  }

  useEffect(() => clearTap, [])

  const onPointerDown = (e: PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerUp = (e: PointerEvent) => {
    // A drag/swipe travelled too far to count as a tap.
    if (
      Math.abs(e.clientX - down.current.x) > TAP_SLOP ||
      Math.abs(e.clientY - down.current.y) > TAP_SLOP
    ) {
      lastTap.current = { time: 0, x: 0, y: 0 }
      return
    }

    const prev = lastTap.current
    const quick = e.timeStamp - prev.time < DOUBLE_MS
    const near =
      Math.abs(e.clientX - prev.x) < GAP_SLOP &&
      Math.abs(e.clientY - prev.y) < GAP_SLOP

    if (onDoubleTap && quick && near) {
      clearTap()
      lastTap.current = { time: 0, x: 0, y: 0 }
      onDoubleTap()
      return
    }

    lastTap.current = { time: e.timeStamp, x: e.clientX, y: e.clientY }
    if (onTap) tapTimer.current = window.setTimeout(onTap, DOUBLE_MS)
  }

  return { onPointerDown, onPointerUp }
}
