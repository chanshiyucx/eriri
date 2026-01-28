import { throttle } from 'lodash-es'
import { useEffect, useRef } from 'react'
import type { BookProgress, ComicProgress } from '@/types/library'

const PROGRESS_THROTTLE_DELAY = 300

export function useThrottledProgress(
  updateFn: (id: string, progress: ComicProgress | BookProgress) => void,
) {
  const throttled = useRef(
    throttle(updateFn, PROGRESS_THROTTLE_DELAY, {
      leading: false,
      trailing: true,
    }),
  )

  useEffect(() => {
    const fn = throttled.current
    return () => {
      fn.flush()
      fn.cancel()
    }
  }, [])

  return throttled
}
