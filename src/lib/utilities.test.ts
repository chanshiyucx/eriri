import { describe, expect, it } from 'vitest'
import { range } from '@/lib/helper'
import { SHORTCUTS } from '@/lib/shortcuts'
import { cn } from '@/lib/style'

describe('frontend utilities', () => {
  it('creates half-open numeric ranges', () => {
    expect(range(2, 5)).toEqual([2, 3, 4])
    expect(range(3, 3)).toEqual([])
  })

  it('merges conditional classes and resolves Tailwind conflicts', () => {
    const classes = cn('px-2', null, ['text-sm', 'px-4']).split(/\s+/)

    expect(classes).toEqual(expect.arrayContaining(['text-sm', 'px-4']))
    expect(classes).not.toContain('px-2')
    expect(classes).toHaveLength(2)
  })

  it('keeps keyboard shortcuts layout-independent', () => {
    expect(SHORTCUTS).toMatchObject({
      toggleImmersive: 'Space',
      prevImage: 'ArrowLeft',
      nextImage: 'ArrowRight',
    })
  })
})
