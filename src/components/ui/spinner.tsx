import type { CSSProperties } from 'react'
import { range } from '@/lib/helper'
import { cn } from '@/lib/style'

type Size = 'small' | 'large'

interface SpinnerProps {
  size?: Size
}

interface LineProps {
  order: number
  size: Size
}

const Line = ({ order, size }: LineProps) => {
  // The `animate-spinner-scale` utility reads its duration/delay from these CSS
  // custom properties (see --animate-spinner-scale in theme.css); setting
  // animationDelay directly is ignored by the shorthand's var() defaults.
  const style = {
    '--duration': '1s',
    '--delay': `${order * 0.1}s`,
  } as CSSProperties
  const h = size === 'small' ? 'h-6' : 'h-10'

  return (
    <span
      style={style}
      className={cn(
        h,
        'animate-spinner-scale bg-muted inline-block w-1 rounded-md',
      )}
    />
  )
}

export function Spinner({ size = 'small' }: SpinnerProps) {
  const gap = size === 'small' ? 'gap-0.5' : 'gap-2'
  return (
    <span className={cn(gap, 'flex')}>
      {range(0, 5).map((i) => (
        <Line key={`spinner-line-${i}`} order={i} size={size} />
      ))}
    </span>
  )
}
