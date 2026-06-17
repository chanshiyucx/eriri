import { act, renderHook } from '@testing-library/react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useIsPhone } from '@/hooks/use-is-phone'
import { useNativeOpen } from '@/hooks/use-native-open'
import { usePanelNav } from '@/hooks/use-panel-nav'
import { openPathNative } from '@/lib/scanner'
import { useUIStore } from '@/store/ui'

vi.mock('@/hooks/use-is-phone', () => ({ useIsPhone: vi.fn() }))
vi.mock('@/lib/scanner', () => ({ openPathNative: vi.fn() }))

const mockUseIsPhone = vi.mocked(useIsPhone)
const mockOpenPathNative = vi.mocked(openPathNative)

describe('navigation hooks', () => {
  beforeEach(() => {
    mockUseIsPhone.mockReturnValue(false)
    mockOpenPathNative.mockResolvedValue(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    )
    useUIStore.setState(useUIStore.getInitialState(), true)
  })

  it('does not expose native open on phones', () => {
    mockUseIsPhone.mockReturnValue(true)

    const { result } = renderHook(() => useNativeOpen('/comic'))

    expect(result.current).toBeUndefined()
  })

  it('prevents the browser menu before opening a native path', () => {
    const preventDefault = vi.fn()
    const { result } = renderHook(() => useNativeOpen('/comic'))

    act(() => {
      result.current?.({ preventDefault } as unknown as ReactMouseEvent)
    })

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(mockOpenPathNative).toHaveBeenCalledWith('/comic')
  })

  it('keeps desktop panels visible without mutating mobile navigation state', () => {
    const { result } = renderHook(() => usePanelNav())

    act(() => {
      result.current.openMiddle()
      result.current.openReader()
    })

    expect(result.current).toMatchObject({
      isPhone: false,
      readerVisible: true,
      middleClass: 'hidden md:flex',
      readerClass: 'hidden md:flex',
    })
    expect(useUIStore.getState()).toMatchObject({
      isSidebarCollapsed: false,
      isMiddleCollapsed: false,
    })
  })

  it('moves through middle and reader panels on phones', () => {
    mockUseIsPhone.mockReturnValue(true)
    const { result } = renderHook(() => usePanelNav())

    act(() => {
      result.current.openMiddle()
    })
    expect(useUIStore.getState()).toMatchObject({
      isSidebarCollapsed: true,
      isMiddleCollapsed: false,
    })
    expect(result.current.middleClass).toBe('flex md:flex')

    act(() => {
      result.current.openReader()
    })
    expect(useUIStore.getState().isMiddleCollapsed).toBe(true)
  })

  it('derives classes for collapsed desktop panels', () => {
    useUIStore.setState({ isSidebarCollapsed: true, isMiddleCollapsed: true })

    const { result } = renderHook(() => usePanelNav())

    expect(result.current).toMatchObject({
      readerVisible: true,
      middleClass: 'hidden md:hidden',
      readerClass: 'flex md:flex',
    })
  })
})
