import { describe, expect, it, vi } from 'vitest'
import { createBookProgress, createComicProgress } from '@/lib/progress'

describe('reading progress', () => {
  it('calculates comic progress as the current page over the last page', () => {
    vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'))

    expect(createComicProgress(2, 5)).toEqual({
      current: 2,
      total: 5,
      percent: 50,
      lastRead: Date.parse('2026-01-02T03:04:05.000Z'),
    })
  })

  it('uses the latest chapter at or before the current book line', () => {
    vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'))

    expect(
      createBookProgress(4, 11, [
        { title: '序章', lineIndex: 0 },
        { title: '第一章 开始', lineIndex: 3 },
        { title: '第二章 继续', lineIndex: 8 },
      ]),
    ).toEqual({
      current: 4,
      total: 11,
      percent: 40,
      currentChapterTitle: '第一章 开始',
      lastRead: Date.parse('2026-01-02T03:04:05.000Z'),
    })
  })

  it('treats single-page comics and single-line books as complete', () => {
    vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'))

    expect(createComicProgress(0, 1).percent).toBe(100)
    expect(createBookProgress(0, 1, []).percent).toBe(100)
  })
})
