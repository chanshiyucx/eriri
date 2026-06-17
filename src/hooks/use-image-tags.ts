import { useTagReveal } from '@/hooks/use-tag-reveal'
import type { FileTags, Image } from '@/types/library'

type TagWriter = (id: string, filename: string, tags: FileTags) => Promise<void>

/**
 * Tap-to-reveal tagging for a full-size page (preview + scroll strip): wires the
 * shared reveal interaction and derives the tag handlers, returning the
 * `gestures` for the figure and `controls` to spread into a <TagOverlay>.
 */
export function useImageTags(
  comicId: string,
  image: Image,
  onTags: TagWriter | undefined,
  onDoubleTap: () => void,
) {
  const { ref, open, gestures, close } = useTagReveal(onDoubleTap)
  const setTag = (tags: FileTags) =>
    void onTags?.(comicId, image.filename, tags)

  return {
    ref,
    gestures,
    controls: {
      open,
      title: image.filename,
      starred: image.starred,
      deleted: image.deleted,
      onStar: () => {
        setTag({ starred: !image.starred })
      },
      onDelete: () => {
        setTag({ deleted: !image.deleted })
      },
      onClose: close,
    },
  }
}
