interface ThrottleOptions {
  leading?: boolean
  trailing?: boolean
}

export interface DebouncedFunction<A extends unknown[]> {
  (...args: A): void
  cancel: () => void
  flush: () => void
}

export function debounce<A extends unknown[]>(
  func: (...args: A) => void,
  wait: number,
  immediate = false,
): DebouncedFunction<A> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let lastArgs: A | undefined

  const debounced = ((...args: A) => {
    lastArgs = args

    const later = () => {
      timeoutId = undefined
      if (!immediate && lastArgs) {
        func(...lastArgs)
      }
    }

    const shouldCallNow = immediate && timeoutId === undefined
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(later, wait)

    if (shouldCallNow) func(...args)
  }) as DebouncedFunction<A>

  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = undefined
    lastArgs = undefined
  }

  debounced.flush = () => {
    if (timeoutId && lastArgs) {
      func(...lastArgs)
      debounced.cancel()
    }
  }

  return debounced
}

export interface ThrottledFunction<A extends unknown[]> {
  (...args: A): void
  cancel: () => void
  flush: () => void
}

export function throttle<A extends unknown[]>(
  func: (...args: A) => void,
  wait: number,
  { leading = true, trailing = true }: ThrottleOptions = {},
): ThrottledFunction<A> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let lastTime = 0
  let lastArgs: A | undefined

  const invoke = (args: A) => {
    func(...args)
    lastTime = Date.now()
    lastArgs = undefined
  }

  const throttled = ((...args: A) => {
    const now = Date.now()
    if (!lastTime && !leading) lastTime = now
    const remaining = wait - (now - lastTime)

    lastArgs = args

    if (remaining <= 0 || remaining > wait) {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
      invoke(args)
    } else if (!timeoutId && trailing) {
      timeoutId = setTimeout(() => {
        timeoutId = undefined
        if (lastArgs) {
          invoke(lastArgs)
        }
      }, remaining)
    }
  }) as ThrottledFunction<A>

  throttled.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = undefined
    lastTime = 0
    lastArgs = undefined
  }

  throttled.flush = () => {
    if (timeoutId && lastArgs) {
      invoke(lastArgs)
      throttled.cancel()
    }
  }

  return throttled
}
