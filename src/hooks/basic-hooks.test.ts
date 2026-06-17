import { act, renderHook } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useClickOutside } from '@/hooks/use-click-outside'
import { useImageTags } from '@/hooks/use-image-tags'
import { getServerPhoneSnapshot, useIsPhone } from '@/hooks/use-is-phone'
import { stopPointerProps, usePressGestures } from '@/hooks/use-press-gestures'
import { useScrollLock } from '@/hooks/use-scroll-lock'
import { useTagReveal } from '@/hooks/use-tag-reveal'
import { useThrottledProgress } from '@/hooks/use-throttled-progress'
import type { Image } from '@/types/library'

function pointerEvent(
  clientX: number,
  clientY: number,
  timeStamp: number,
): ReactPointerEvent {
  return { clientX, clientY, timeStamp } as ReactPointerEvent
}

describe('basic reader hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    document.body.replaceChildren()
  })

  it('fires click-outside only for enabled clicks beyond the referenced node', () => {
    const element = document.createElement('div')
    const child = document.createElement('span')
    element.append(child)
    document.body.append(element)
    const ref: RefObject<HTMLDivElement | null> = { current: element }
    const handler = vi.fn()
    const { rerender, unmount } = renderHook(
      ({ enabled }) => {
        useClickOutside(ref, handler, enabled)
      },
      { initialProps: { enabled: true } },
    )

    child.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(handler).not.toHaveBeenCalled()

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(handler).toHaveBeenCalledOnce()

    ref.current = null
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(handler).toHaveBeenCalledOnce()

    rerender({ enabled: false })
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(handler).toHaveBeenCalledOnce()
    unmount()
  })

  it('subscribes to phone breakpoint changes and removes the listener', () => {
    let matches = false
    let listener: (() => void) | undefined
    const removeEventListener = vi.fn()
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        addEventListener: vi.fn((_event: string, callback: () => void) => {
          listener = callback
        }),
        removeEventListener,
      })),
    )
    const { result, unmount } = renderHook(() => useIsPhone())

    expect(result.current).toBe(false)
    matches = true
    act(() => {
      listener?.()
    })
    expect(result.current).toBe(true)

    unmount()
    expect(removeEventListener).toHaveBeenCalledWith('change', listener)
    expect(getServerPhoneSnapshot()).toBe(false)
  })

  it('recognizes taps, double taps, movement and delayed single taps', () => {
    const onTap = vi.fn()
    const onDoubleTap = vi.fn()
    const { result, unmount } = renderHook(() =>
      usePressGestures({ onTap, onDoubleTap }),
    )

    act(() => {
      result.current.onPointerDown(pointerEvent(10, 10, 1))
      result.current.onPointerUp(pointerEvent(30, 10, 10))
    })
    expect(onTap).not.toHaveBeenCalled()

    act(() => {
      result.current.onPointerDown(pointerEvent(10, 10, 1000))
      result.current.onPointerUp(pointerEvent(10, 10, 1000))
      vi.advanceTimersByTime(350)
    })
    expect(onTap).toHaveBeenCalledOnce()

    act(() => {
      result.current.onPointerDown(pointerEvent(20, 20, 2000))
      result.current.onPointerUp(pointerEvent(20, 20, 2000))
      result.current.onPointerDown(pointerEvent(22, 22, 2100))
      result.current.onPointerUp(pointerEvent(22, 22, 2100))
    })
    expect(onDoubleTap).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)

    unmount()
  })

  it('supports double-tap-only gestures and stops child pointer bubbling', () => {
    const onDoubleTap = vi.fn()
    const { result } = renderHook(() => usePressGestures({ onDoubleTap }))

    act(() => {
      result.current.onPointerDown(pointerEvent(1, 1, 100))
      result.current.onPointerUp(pointerEvent(1, 1, 100))
      result.current.onPointerDown(pointerEvent(2, 2, 150))
      result.current.onPointerUp(pointerEvent(2, 2, 150))
    })
    expect(onDoubleTap).toHaveBeenCalledTimes(2)

    const stopPropagation = vi.fn()
    const event = { stopPropagation } as unknown as ReactPointerEvent
    stopPointerProps.onPointerDown(event)
    stopPointerProps.onPointerUp(event)
    expect(stopPropagation).toHaveBeenCalledTimes(2)
  })

  it('locks scrolling, resets visible indices and unlocks after the delay', () => {
    const { result } = renderHook(() => useScrollLock())
    result.current.visibleIndices.current.add(4)

    act(() => {
      result.current.lockScroll()
    })
    expect(result.current.isLock.current).toBe(true)
    expect(result.current.visibleIndices.current.size).toBe(0)

    act(() => {
      result.current.lockScroll()
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.isLock.current).toBe(false)
  })

  it('reveals tags on a single tap, closes outside and handles double taps', () => {
    const onDoubleTap = vi.fn()
    const { result } = renderHook(() => useTagReveal(onDoubleTap))
    const element = document.createElement('div')
    document.body.append(element)
    result.current.ref.current = element

    act(() => {
      result.current.gestures.onPointerDown(pointerEvent(10, 10, 1000))
      result.current.gestures.onPointerUp(pointerEvent(10, 10, 1000))
      vi.advanceTimersByTime(350)
    })
    expect(result.current.open).toBe(true)

    act(() => {
      document.body.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true }),
      )
    })
    expect(result.current.open).toBe(false)

    act(() => {
      result.current.gestures.onPointerDown(pointerEvent(10, 10, 2000))
      result.current.gestures.onPointerUp(pointerEvent(10, 10, 2000))
      result.current.gestures.onPointerDown(pointerEvent(11, 11, 2100))
      result.current.gestures.onPointerUp(pointerEvent(11, 11, 2100))
    })
    expect(onDoubleTap).toHaveBeenCalledOnce()
  })

  it('keeps tag reveal closed when single taps are disabled', () => {
    const { result } = renderHook(() => useTagReveal(vi.fn(), false))

    act(() => {
      result.current.gestures.onPointerDown(pointerEvent(1, 1, 1000))
      result.current.gestures.onPointerUp(pointerEvent(1, 1, 1000))
      vi.runAllTimers()
      result.current.close()
    })
    expect(result.current.open).toBe(false)
  })

  it('derives image tag controls and writes toggled values', () => {
    const image = {
      filename: '001.jpg',
      starred: true,
      deleted: false,
    } as Image
    const onTags = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ writer }) => useImageTags('comic-1', image, writer, vi.fn()),
      { initialProps: { writer: onTags as typeof onTags | undefined } },
    )

    act(() => {
      result.current.controls.onStar()
      result.current.controls.onDelete()
      result.current.controls.onClose()
    })
    expect(onTags).toHaveBeenNthCalledWith(1, 'comic-1', '001.jpg', {
      starred: false,
    })
    expect(onTags).toHaveBeenNthCalledWith(2, 'comic-1', '001.jpg', {
      deleted: true,
    })
    expect(result.current.controls).toMatchObject({
      title: '001.jpg',
      starred: true,
      deleted: false,
    })

    rerender({ writer: undefined })
    act(() => {
      result.current.controls.onStar()
    })
    expect(onTags).toHaveBeenCalledTimes(2)
  })

  it('flushes and cancels throttled progress when unmounted', () => {
    const update = vi.fn()
    const { result, unmount } = renderHook(() => useThrottledProgress(update))
    const progress = { current: 1, total: 2, percent: 50, lastRead: 1 }

    act(() => {
      result.current.current('comic-1', progress)
    })
    expect(update).not.toHaveBeenCalled()
    unmount()
    expect(update).toHaveBeenCalledWith('comic-1', progress)
    expect(vi.getTimerCount()).toBe(0)
  })
})
