import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useComicReaderControls } from '@/hooks/use-comic-reader-controls'
import type { Comic, Image } from '@/types/library'

const comic: Comic = {
  id: 'comic-1',
  title: 'Comic One',
  path: '/comics/one',
  cover: '/cover.jpg',
  libraryId: 'library-1',
  starred: false,
  deleted: false,
  createdAt: 1,
}

function image(index: number): Image {
  return {
    path: `/comics/one/${index}.jpg`,
    url: `/file/${index}`,
    thumbnail: `/thumb/${index}`,
    filename: `${index}.jpg`,
    starred: false,
    deleted: false,
    width: 100,
    height: 200,
    index,
  }
}

describe('useComicReaderControls', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('jumps immediately, clamps indices and syncs preview close', () => {
    const updateComicProgress = vi.fn()
    const jumpTo = vi.fn()
    const stripRef = { current: { jumpTo } }
    const { result } = renderHook(() =>
      useComicReaderControls({
        comicId: 'comic-1',
        images: [image(0), image(1)],
        savedIndex: 0,
        updateComicProgress,
      }),
    )

    act(() => {
      result.current.jumpTo(comic, { current: null })
    })
    expect(updateComicProgress).toHaveBeenLastCalledWith(
      'comic-1',
      expect.objectContaining({ current: 0, total: 2 }),
    )

    act(() => {
      result.current.jumpTo(comic, stripRef, 99)
    })
    expect(result.current.currentIndex).toBe(1)
    expect(jumpTo).toHaveBeenLastCalledWith(1)
    expect(updateComicProgress).toHaveBeenLastCalledWith(
      'comic-1',
      expect.objectContaining({
        current: 1,
        percent: 100,
        lastRead: Date.parse('2026-01-02T03:04:05.000Z'),
      }),
    )

    act(() => {
      result.current.setPreviewIndex(1)
    })
    expect(result.current.getTagTargetImage('preview-first')?.filename).toBe(
      '1.jpg',
    )
    expect(result.current.getTagTargetImage('preview-only')?.filename).toBe(
      '1.jpg',
    )

    act(() => {
      result.current.closePreview(comic, stripRef, true)
    })
    expect(result.current.previewIndex).toBe(-1)
    expect(result.current.currentIndex).toBe(1)
    expect(jumpTo).toHaveBeenLastCalledWith(1)
  })

  it('tracks strip progress through the throttled interface and guards invalid inputs', () => {
    const updateComicProgress = vi.fn()
    const { result, rerender, unmount } = renderHook(
      ({ images }) =>
        useComicReaderControls({
          comicId: 'comic-1',
          images,
          savedIndex: 0,
          updateComicProgress,
        }),
      { initialProps: { images: [image(0), image(1)] } },
    )

    act(() => {
      result.current.trackStripIndex(undefined, 1)
      result.current.trackStripIndex(comic, 1, false)
    })
    expect(updateComicProgress).not.toHaveBeenCalled()

    rerender({ images: [] })
    act(() => {
      result.current.trackStripIndex(comic, 1)
      result.current.jumpTo(comic, { current: { jumpTo: vi.fn() } }, 1)
    })
    expect(updateComicProgress).not.toHaveBeenCalled()

    rerender({ images: [image(0), image(1)] })
    act(() => {
      result.current.trackStripIndex(comic, 1)
    })
    expect(result.current.currentIndex).toBe(1)
    expect(updateComicProgress).not.toHaveBeenCalled()

    unmount()
    expect(updateComicProgress).toHaveBeenCalledWith(
      'comic-1',
      expect.objectContaining({ current: 1, total: 2 }),
    )
  })

  it('falls back from local position to saved progress when the comic changes', () => {
    const updateComicProgress = vi.fn()
    const { result, rerender } = renderHook(
      ({ comicId, savedIndex }) =>
        useComicReaderControls({
          comicId,
          images: [image(0), image(1)],
          savedIndex,
          updateComicProgress,
        }),
      { initialProps: { comicId: 'comic-1', savedIndex: 0 } },
    )

    expect(result.current.getTagTargetImage('hover-first')?.filename).toBe(
      '0.jpg',
    )

    act(() => {
      result.current.setHoveredIndex(1)
    })
    expect(result.current.getTagTargetImage('hover-first')?.filename).toBe(
      '1.jpg',
    )

    rerender({ comicId: 'comic-2', savedIndex: 1 })
    expect(result.current.currentIndex).toBe(1)

    act(() => {
      result.current.setPreviewIndex(1)
      result.current.closePreview(undefined, { current: null }, false)
    })
    expect(result.current.previewIndex).toBe(-1)
  })
})
