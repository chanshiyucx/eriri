import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useComicReadingSession,
  type ComicTagTargetPolicy,
} from '@/hooks/use-comic-reading-session'
import { useLibraryStore } from '@/store/library'
import { useProgressStore } from '@/store/progress'
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

function seedSessionState(images: Image[] = [image(0), image(1)]) {
  const getComicImages = vi.fn().mockResolvedValue(images)
  const updateComicImageTags = vi.fn().mockResolvedValue(undefined)
  const updateComicProgress = vi.fn()

  useLibraryStore.setState({
    comics: { 'comic-1': comic },
    comicImages: images.length
      ? {
          'comic-1': {
            comicId: 'comic-1',
            status: 'ready',
            images,
            timestamp: 1,
          },
        }
      : {},
    getComicImages,
    updateComicImageTags,
  })
  useProgressStore.setState({
    comics: {
      'comic-1': { current: 0, total: 2, percent: 50, lastRead: 1 },
    },
    updateComicProgress,
  })

  return { getComicImages, updateComicImageTags, updateComicProgress }
}

describe('useComicReadingSession', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'))
    useLibraryStore.setState(useLibraryStore.getInitialState(), true)
    useProgressStore.setState(useProgressStore.getInitialState(), true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads Comic Image readiness without owning the cache implementation', () => {
    const { getComicImages } = seedSessionState([])
    const stripRef = { current: { jumpTo: vi.fn() } }

    const { result } = renderHook(() =>
      useComicReadingSession({
        comicId: 'comic-1',
        stripRef,
        stripVisible: true,
        tagTargetPolicy: 'reader',
      }),
    )

    expect(result.current.isReady).toBe(false)
    expect(result.current.images).toEqual([])
    expect(getComicImages).toHaveBeenCalledWith('comic-1')
  })

  it('jumps, clamps indices and restores the visible strip', () => {
    const { updateComicProgress } = seedSessionState()
    const jumpTo = vi.fn()
    const stripRef = { current: { jumpTo } }

    const { result } = renderHook(() =>
      useComicReadingSession({
        comicId: 'comic-1',
        stripRef,
        stripVisible: true,
        tagTargetPolicy: 'reader',
      }),
    )
    jumpTo.mockClear()

    act(() => {
      result.current.jumpTo(99)
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
  })

  it('tracks visible strip progress through the throttled writer', () => {
    const { updateComicProgress } = seedSessionState()
    const stripRef = { current: { jumpTo: vi.fn() } }

    const { result, rerender, unmount } = renderHook(
      ({ stripVisible }) =>
        useComicReadingSession({
          comicId: 'comic-1',
          stripRef,
          stripVisible,
          tagTargetPolicy: 'reader',
        }),
      { initialProps: { stripVisible: false } },
    )

    act(() => {
      result.current.trackStripIndex(1)
    })
    expect(updateComicProgress).not.toHaveBeenCalled()

    rerender({ stripVisible: true })
    act(() => {
      result.current.trackStripIndex(1)
    })
    expect(result.current.currentIndex).toBe(1)
    expect(updateComicProgress).not.toHaveBeenCalled()

    unmount()
    expect(updateComicProgress).toHaveBeenCalledWith(
      'comic-1',
      expect.objectContaining({ current: 1, total: 2 }),
    )
  })

  it('adopts late Reading Progress until the session has a local position', () => {
    seedSessionState()
    const stripRef = { current: { jumpTo: vi.fn() } }

    const { result } = renderHook(() =>
      useComicReadingSession({
        comicId: 'comic-1',
        stripRef,
        stripVisible: true,
        tagTargetPolicy: 'reader',
      }),
    )

    expect(result.current.currentIndex).toBe(0)

    act(() => {
      useProgressStore.setState({
        comics: {
          'comic-1': { current: 1, total: 2, percent: 100, lastRead: 2 },
        },
      })
    })
    expect(result.current.currentIndex).toBe(1)

    act(() => {
      result.current.jumpTo(0)
    })
    act(() => {
      useProgressStore.setState({
        comics: {
          'comic-1': { current: 1, total: 2, percent: 100, lastRead: 3 },
        },
      })
    })
    expect(result.current.currentIndex).toBe(0)
  })

  it('resolves File Tag shortcut targets by reader and library policies', () => {
    const { updateComicImageTags } = seedSessionState()
    const stripRef = { current: { jumpTo: vi.fn() } }

    const { result, rerender } = renderHook(
      ({ tagTargetPolicy }) =>
        useComicReadingSession({
          comicId: 'comic-1',
          stripRef,
          stripVisible: true,
          tagTargetPolicy,
        }),
      {
        initialProps: {
          tagTargetPolicy: 'reader' as ComicTagTargetPolicy,
        },
      },
    )

    act(() => {
      result.current.setHoveredIndex(1)
      result.current.toggleTargetImageStarred()
    })
    expect(updateComicImageTags).toHaveBeenLastCalledWith('comic-1', '1.jpg', {
      starred: true,
    })

    act(() => {
      result.current.setPreviewIndex(0)
    })
    act(() => {
      result.current.toggleTargetImageDeleted()
    })
    expect(updateComicImageTags).toHaveBeenLastCalledWith('comic-1', '0.jpg', {
      deleted: true,
    })

    act(() => {
      result.current.setPreviewIndex(-1)
    })
    rerender({ tagTargetPolicy: 'library-grid' })
    act(() => {
      result.current.toggleTargetImageStarred()
    })
    expect(updateComicImageTags).toHaveBeenCalledTimes(2)

    act(() => {
      result.current.setPreviewIndex(1)
    })
    act(() => {
      result.current.toggleTargetImageStarred()
    })
    expect(updateComicImageTags).toHaveBeenLastCalledWith('comic-1', '1.jpg', {
      starred: true,
    })

    rerender({ tagTargetPolicy: 'library-scroll' })
    act(() => {
      result.current.setHoveredIndex(0)
      result.current.toggleTargetImageDeleted()
    })
    expect(updateComicImageTags).toHaveBeenLastCalledWith('comic-1', '0.jpg', {
      deleted: true,
    })
  })

  it('persists preview close and only syncs the strip when it is visible', () => {
    const { updateComicProgress } = seedSessionState()
    const jumpTo = vi.fn()
    const stripRef = { current: { jumpTo } }

    const { result, rerender } = renderHook(
      ({ stripVisible }) =>
        useComicReadingSession({
          comicId: 'comic-1',
          stripRef,
          stripVisible,
          tagTargetPolicy: 'reader',
        }),
      { initialProps: { stripVisible: true } },
    )
    jumpTo.mockClear()

    act(() => {
      result.current.setPreviewIndex(1)
    })
    act(() => {
      result.current.closePreview()
    })
    expect(result.current.previewIndex).toBe(-1)
    expect(updateComicProgress).toHaveBeenLastCalledWith(
      'comic-1',
      expect.objectContaining({ current: 1 }),
    )
    expect(jumpTo).toHaveBeenLastCalledWith(1)

    rerender({ stripVisible: false })
    jumpTo.mockClear()
    act(() => {
      result.current.setPreviewIndex(0)
    })
    act(() => {
      result.current.closePreview()
    })
    expect(updateComicProgress).toHaveBeenLastCalledWith(
      'comic-1',
      expect.objectContaining({ current: 0 }),
    )
    expect(jumpTo).not.toHaveBeenCalled()
  })
})
