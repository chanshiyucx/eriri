import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/button'
import { GridItem } from '@/components/ui/grid-item'
import {
  GridImage,
  ImagePreview,
  ImagePreviewOverlay,
  ScrollImage,
  SingleImage,
} from '@/components/ui/image-view'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { TagButton } from '@/components/ui/tag-button'
import { TagIcon } from '@/components/ui/tag-icon'
import { TagOverlay } from '@/components/ui/tag-overlay'
import type { Image } from '@/types/library'

function image(index: number, overrides: Partial<Image> = {}): Image {
  return {
    path: `/comic/${index}.jpg`,
    url: `/file/${index}`,
    thumbnail: `/thumb/${index}`,
    filename: `${index}.jpg`,
    starred: false,
    deleted: false,
    width: 100,
    height: 200,
    index,
    ...overrides,
  }
}

describe('shared UI components', () => {
  it('forwards button attributes, merges classes and handles clicks', () => {
    const onClick = vi.fn()
    render(
      <Button className="px-2" disabled onClick={onClick}>
        Save
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('px-2')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('forwards the scroll viewport ref and applies each orientation', () => {
    const ref = createRef<HTMLDivElement>()
    const { rerender } = render(
      <ScrollArea ref={ref} orientation="horizontal" className="custom">
        content
      </ScrollArea>,
    )

    expect(ref.current).toHaveClass('overflow-x-auto', 'custom')
    rerender(
      <ScrollArea ref={ref} orientation="vertical">
        content
      </ScrollArea>,
    )
    expect(ref.current).toHaveClass('overflow-y-auto', 'overflow-x-hidden')
    rerender(<ScrollArea ref={ref}>content</ScrollArea>)
    expect(ref.current).toHaveClass('overflow-auto')
  })

  it('renders five spinner bars with size-specific styles and delays', () => {
    const { container, rerender } = render(<Spinner />)
    const bars = [...container.querySelectorAll('span > span')]

    expect(bars).toHaveLength(5)
    expect(bars[0]).toHaveClass('h-6')
    expect(bars[4]).toHaveStyle({ '--delay': '0.4s' })

    rerender(<Spinner size="large" />)
    expect(container.querySelector('span > span')).toHaveClass('h-10')
  })

  it('stops tag button events before invoking its action', () => {
    const parentClick = vi.fn()
    const onClick = vi.fn()
    render(
      <div onClick={parentClick}>
        <TagButton onClick={onClick}>tag</TagButton>
      </div>,
    )

    const button = screen.getByRole('button', { name: 'tag' })
    fireEvent.pointerDown(button)
    fireEvent.pointerUp(button)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('renders active star and trash icon variants', () => {
    const { container, rerender } = render(
      <TagIcon kind="star" active className="custom" />,
    )
    expect(container.querySelector('svg')).toHaveClass(
      'fill-gold/80',
      'stroke-love',
      'custom',
    )

    rerender(<TagIcon kind="trash" active={false} />)
    expect(container.querySelector('svg')).not.toHaveClass('text-subtle/40')
  })

  it('reveals tag controls, toggles actions and closes the reveal', () => {
    const onStar = vi.fn()
    const onDelete = vi.fn()
    const onClose = vi.fn()
    const { container, rerender } = render(
      <TagOverlay
        layout="card"
        open={false}
        title="001.jpg"
        starred={false}
        deleted={false}
        onStar={onStar}
        onDelete={onDelete}
        onClose={onClose}
      />,
    )
    expect(container).toBeEmptyDOMElement()

    rerender(
      <TagOverlay
        layout="card"
        open
        title="001.jpg"
        starred
        deleted={false}
        onStar={onStar}
        onDelete={onDelete}
        onClose={onClose}
      />,
    )
    expect(screen.getByText('001.jpg')).toBeInTheDocument()
    const trashButton = container.querySelector('.left-0')
    const starButton = container.querySelector('.right-0')
    expect(trashButton).not.toBeNull()
    expect(starButton).not.toBeNull()
    fireEvent.click(trashButton!)
    fireEvent.click(starButton!)
    expect(onDelete).toHaveBeenCalledOnce()
    expect(onStar).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('renders card state, selection and reading progress', () => {
    const onClick = vi.fn()
    render(
      <GridItem
        title="Comic"
        cover="/cover.jpg"
        starred
        deleted
        isSelected
        progress={{ current: 1, total: 4, percent: 50, lastRead: 1 }}
        onClick={onClick}
      />,
    )

    const cover = screen.getByRole('img', { name: 'Comic' })
    expect(cover).toHaveClass('grayscale')
    expect(screen.getByText('2 / 4')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    fireEvent.click(cover)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('maps image actions to their comic, filename and toggled values', () => {
    const onClick = vi.fn()
    const onTags = vi.fn().mockResolvedValue(undefined)
    render(
      <GridImage
        comicId="comic-1"
        image={image(3, { starred: true })}
        isSelected
        onClick={onClick}
        onTags={onTags}
      />,
    )

    const cover = screen.getByRole('img', { name: '3.jpg' })
    fireEvent.click(cover)
    expect(onClick).toHaveBeenCalledWith(3)
    fireEvent.click(screen.getByRole('button'))
    expect(onTags).toHaveBeenCalledWith('comic-1', '3.jpg', {
      starred: false,
    })
  })

  it('renders single and scrolling image attributes', () => {
    const deleted = image(1, { deleted: true })
    const { rerender } = render(
      <SingleImage comicId="comic-1" image={deleted} />,
    )
    expect(screen.getByRole('img', { name: '1.jpg' })).toHaveClass('grayscale')

    rerender(<ScrollImage comicId="comic-1" image={deleted} loading="lazy" />)
    expect(screen.getByRole('img', { name: '1.jpg' })).toHaveAttribute(
      'loading',
      'lazy',
    )
  })

  it('navigates image previews by keyboard and horizontal swipe', () => {
    const images = [image(0), image(1), image(2)]
    const onIndexChange = vi.fn()
    const { container, rerender } = render(
      <ImagePreview
        comicId="comic-1"
        images={images}
        index={1}
        onIndexChange={onIndexChange}
      />,
    )

    fireEvent.keyDown(window, { code: 'ArrowLeft' })
    fireEvent.keyDown(window, { code: 'ArrowRight' })
    fireEvent.keyDown(window, { code: 'ArrowRight', metaKey: true })
    expect(onIndexChange).toHaveBeenNthCalledWith(1, 0)
    expect(onIndexChange).toHaveBeenNthCalledWith(2, 2)

    const preview = container.firstElementChild as HTMLElement
    fireEvent.touchStart(preview, {
      touches: [{ clientX: 100, clientY: 10 }],
    })
    fireEvent.touchEnd(preview, {
      changedTouches: [{ clientX: 20, clientY: 15 }],
    })
    expect(onIndexChange).toHaveBeenLastCalledWith(2)

    fireEvent.touchEnd(preview, {
      changedTouches: [{ clientX: 200, clientY: 15 }],
    })
    expect(onIndexChange).toHaveBeenCalledTimes(3)

    rerender(
      <ImagePreview
        comicId="comic-1"
        images={images}
        index={-1}
        onIndexChange={onIndexChange}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('keeps the preview overlay mounted while toggling visibility', () => {
    const images = [image(0)]
    const props = {
      comicId: 'comic-1',
      images,
      onIndexChange: vi.fn(),
      onClose: vi.fn(),
      onTags: vi.fn().mockResolvedValue(undefined),
    }
    const { container, rerender } = render(
      <ImagePreviewOverlay {...props} index={-1} />,
    )
    expect(container.firstElementChild).toHaveClass('hidden')

    rerender(<ImagePreviewOverlay {...props} index={0} />)
    expect(container.firstElementChild).toHaveClass('visible')
  })
})
