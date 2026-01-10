import { MediaPlayer, MediaProvider } from '@vidstack/react'
import {
  PlyrLayout,
  plyrLayoutIcons,
  type PlyrControl,
} from '@vidstack/react/player/layouts/plyr'
import { memo, useEffect, useRef, useState } from 'react'
import '@vidstack/react/player/styles/base.css'
import '@vidstack/react/player/styles/plyr/theme.css'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'

const PLAYER_CONTROLS: PlyrControl[] = [
  'play-large',
  'play',
  'progress',
  'current-time',
  'duration',
  'mute+volume',
  'settings',
]

interface VideoPlayerProps {
  videoId: string
}

export const VideoPlayer = memo(function VideoPlayer({
  videoId,
}: VideoPlayerProps) {
  const video = useLibraryStore((s) => s.videos[videoId])
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldFillHeight, setShouldFillHeight] = useState(false)

  useEffect(() => {
    if (!video?.width || !video?.height || !containerRef.current) return

    const updateLayout = () => {
      const container = containerRef.current
      if (!container) return

      const containerRatio = container.clientWidth / container.clientHeight
      const videoRatio = video.width / video.height
      setShouldFillHeight(containerRatio > videoRatio)
    }

    updateLayout()

    const resizeObserver = new ResizeObserver(updateLayout)
    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [video?.width, video?.height])

  if (!video) return null

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full flex-1 items-center justify-center"
    >
      <MediaPlayer
        title={video.title}
        src={video.url}
        poster={video.cover}
        autoPlay={true}
        className={cn(
          'max-h-full max-w-full rounded-none! bg-black',
          shouldFillHeight
            ? 'h-full [&_video]:!h-full [&_video]:!w-auto'
            : 'w-full [&_video]:!h-auto [&_video]:!w-full',
        )}
      >
        <MediaProvider />
        <PlyrLayout icons={plyrLayoutIcons} controls={PLAYER_CONTROLS} />
      </MediaPlayer>
    </div>
  )
})
